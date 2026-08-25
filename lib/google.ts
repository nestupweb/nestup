import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoogleToken } from "@/lib/types";

/**
 * Google OAuth + Calendar REST helpers. Server-only: reads GOOGLE_CLIENT_ID /
 * GOOGLE_CLIENT_SECRET and never ships tokens to the browser.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Public origin for OAuth redirects: explicit env wins, else the request's own origin. */
export function siteOrigin(requestUrl: string): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(requestUrl).origin;
}

export function googleRedirectUri(origin: string): string {
  return `${origin}/api/google/callback`;
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...params,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  return tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return "";
  const json = (await res.json()) as { email?: unknown };
  return typeof json.email === "string" ? json.email : "";
}

export interface GoogleConnection {
  accessToken: string;
  email: string;
}

/**
 * The caller's Google connection with a usable access token, refreshing it
 * when it is about to expire. Null when the user never connected (or the
 * refresh token was revoked).
 */
export async function getGoogleConnection(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleConnection | null> {
  const { data } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as GoogleToken | null;
  if (!row) return null;

  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) {
    return { accessToken: row.access_token, email: row.email };
  }
  try {
    const fresh = await refreshAccessToken(row.refresh_token);
    const expires_at = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
    await supabase
      .from("google_tokens")
      .update({ access_token: fresh.access_token, expires_at, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { accessToken: fresh.access_token, email: row.email };
  } catch {
    return null;
  }
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendees: string[];
}

/** Creates the event on the user's primary calendar and emails every attendee. */
export async function createCalendarEvent(
  accessToken: string,
  input: CalendarEventInput
): Promise<{ id: string; htmlLink: string }> {
  const res = await fetch(`${EVENTS_URL}?sendUpdates=all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
      end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
      attendees: input.attendees.map((email) => ({ email })),
      reminders: { useDefault: true },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Calendar rejected the event (${res.status})`);
  const json = (await res.json()) as { id: string; htmlLink?: string };
  return { id: json.id, htmlLink: json.htmlLink ?? "" };
}

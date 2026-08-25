import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { exchangeCode, fetchGoogleEmail, googleRedirectUri, siteOrigin } from "@/lib/google";
import { sanitizeNextPath } from "@/lib/redirect";

const STATE_COOKIE = "nestup_google_oauth";

/** Google redirects here with `code` + `state`; we store tokens for the signed-in user. */
export async function GET(request: NextRequest) {
  const origin = siteOrigin(request.url);
  const raw = request.cookies.get(STATE_COOKIE)?.value ?? "";
  const sep = raw.indexOf("|");
  const expectedState = sep === -1 ? raw : raw.slice(0, sep);
  const returnPath = sanitizeNextPath(sep === -1 ? "" : raw.slice(sep + 1), "/chat");

  const finish = (status: "connected" | "error") => {
    const res = NextResponse.redirect(`${origin}${returnPath}?calendar=${status}`);
    res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || !expectedState || state !== expectedState) return finish("error");

  const { supabase, user } = await getAuthContext();
  if (!user) return finish("error");

  try {
    const token = await exchangeCode(code, googleRedirectUri(origin));
    if (!token.refresh_token) return finish("error");
    const email = await fetchGoogleEmail(token.access_token);
    const { error } = await supabase.from("google_tokens").upsert({
      user_id: user.id,
      refresh_token: token.refresh_token,
      access_token: token.access_token,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      email,
      updated_at: new Date().toISOString(),
    });
    if (error) return finish("error");
    return finish("connected");
  } catch {
    return finish("error");
  }
}

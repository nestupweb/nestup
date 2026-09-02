"use server";

import { refresh, updateTag } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { chatTag } from "@/lib/cache-tags";
import { fitsAvailability, normalizeSlots } from "@/lib/availability";
import {
  VIEWING_DURATIONS,
  describeViewing,
  isValidViewingStart,
  viewingWindow,
  type ViewingDuration,
} from "@/lib/calendar";
import { OPEN_VIEWING_MESSAGE } from "@/lib/chat-outbox";
import { createCalendarEvent, getGoogleConnection } from "@/lib/google";
import type { ConversationSummary, Viewing, ViewingStatus } from "@/lib/types";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type ViewingFormState = { error?: string; warning?: string; done?: number };
export type ViewingResult = { ok: boolean; error?: string; warning?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requestOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}

async function myConversation(supabase: SupabaseClient, conversationId: string): Promise<ConversationSummary | null> {
  const { data: rows } = await supabase.rpc("my_conversations");
  return ((rows as ConversationSummary[] | null) ?? []).find((c) => c.id === conversationId) ?? null;
}

/**
 * Request a viewing inside a chat. Seekers must pick a time inside the host's
 * viewing hours. Nothing reaches a calendar until the other party approves.
 */
export async function proposeViewingAction(
  _prev: ViewingFormState,
  formData: FormData
): Promise<ViewingFormState> {
  const { supabase, user } = await requireUser();

  const conversationId = String(formData.get("conversation_id") ?? "");
  if (!UUID_RE.test(conversationId)) return { error: "Could not find this conversation." };

  const startsAt = String(formData.get("starts_at") ?? "");
  if (!isValidViewingStart(startsAt)) return { error: "Pick a date and time in the future." };

  const durationRaw = Number(formData.get("duration") ?? 45);
  const duration: ViewingDuration = (VIEWING_DURATIONS as readonly number[]).includes(durationRaw)
    ? (durationRaw as ViewingDuration)
    : 45;
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const { start, end } = viewingWindow(startsAt, duration);

  // Participant check + listing context in one RLS-scoped call.
  const conv = await myConversation(supabase, conversationId);
  if (!conv) return { error: "Could not find this conversation." };

  if (conv.seeker_id === user.id) {
    const slots = normalizeSlots(conv.listing_viewing_slots);
    if (!fitsAvailability(slots, start.toISOString(), end.toISOString())) {
      return { error: "Pick a time inside the host's viewing hours." };
    }
  }

  // One open viewing per chat (the viewings_one_open trigger enforces the same).
  const { data: open } = await supabase
    .from("viewings")
    .select("status")
    .eq("conversation_id", conversationId)
    .in("status", ["proposed", "confirmed"])
    .gt("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(1)
    .maybeSingle();
  if (open) return { error: OPEN_VIEWING_MESSAGE[(open as { status: "proposed" | "confirmed" }).status] };

  const { error } = await supabase.from("viewings").insert({
    conversation_id: conversationId,
    proposed_by: user.id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    note,
  });
  if (error) {
    return {
      error: error.message.includes("already scheduled") ? OPEN_VIEWING_MESSAGE.confirmed : "Could not save the viewing. Please try again.",
    };
  }

  // A viewing puts the "Viewing scheduled" chip on the conversation's inbox
  // row, so the cached inbox has to go with it — the thread alone is not the
  // whole surface this changed. Still nothing wider: `revalidatePath` here
  // expired every other page the member had visited, and a viewing request is
  // no reason to throw away their deck.
  updateTag(chatTag(user.id));
  refresh();
  return { done: Date.now() };
}

/** Creates the Google event from `user`'s calendar and mirrors it on the viewing. */
async function mirrorToGoogle(
  supabase: SupabaseClient,
  user: User,
  viewing: Viewing,
  conv: ConversationSummary,
  timeZone: string
): Promise<string | undefined> {
  const google = await getGoogleConnection(supabase, user.id);
  if (!google) return undefined;
  try {
    const { data: partnerEmail } = await supabase.rpc("conversation_partner_email", {
      p_conversation: conv.id,
    });
    const attendees = [...new Set([user.email, partnerEmail].filter((e): e is string => typeof e === "string" && e.length > 0))];
    const origin = await requestOrigin();
    const copy = describeViewing(
      { title: conv.listing_title, address: conv.listing_address, city: conv.listing_city, rent: conv.listing_rent },
      conv.other_name ?? "your NestUp contact",
      viewing.note,
      origin ? `${origin}/chat/${conv.id}` : undefined
    );
    const event = await createCalendarEvent(google.accessToken, {
      ...copy,
      start: new Date(viewing.starts_at),
      end: new Date(viewing.ends_at),
      timeZone,
      attendees,
    });
    await supabase
      .from("viewings")
      .update({ google_event_id: event.id, google_event_link: event.htmlLink })
      .eq("id", viewing.id);
    return undefined;
  } catch {
    return "Approved, but Google Calendar did not accept the event.";
  }
}

const RESPONSES: ViewingStatus[] = ["confirmed", "declined", "cancelled"];

/**
 * Approve / decline (the other party only) or cancel. The database trigger
 * enforces the same rules; this returns a readable message. On approval, the
 * approver's Google Calendar (if connected) creates the event and invites the
 * other side — the first moment anything reaches a calendar.
 */
export async function respondViewingAction(
  viewingId: string,
  status: ViewingStatus,
  conversationId: string,
  timeZone = "Asia/Jerusalem"
): Promise<ViewingResult> {
  if (!UUID_RE.test(viewingId) || !UUID_RE.test(conversationId) || !RESPONSES.includes(status)) {
    return { ok: false, error: "Could not update the viewing." };
  }
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("viewings").select("*").eq("id", viewingId).maybeSingle();
  const viewing = data as Viewing | null;
  if (!viewing || viewing.conversation_id !== conversationId) return { ok: false, error: "Could not find the viewing." };

  if (status !== "cancelled") {
    if (viewing.status !== "proposed") return { ok: false, error: "This viewing is no longer pending." };
    if (viewing.proposed_by === user.id) return { ok: false, error: "The other party has to approve the viewing." };
  } else if (viewing.status === "declined" || viewing.status === "cancelled") {
    return { ok: false, error: "This viewing is already closed." };
  }

  const { error } = await supabase.from("viewings").update({ status }).eq("id", viewingId);
  if (error) return { ok: false, error: "Could not update the viewing." };

  let warning: string | undefined;
  if (status === "confirmed") {
    const conv = await myConversation(supabase, conversationId);
    if (conv) warning = await mirrorToGoogle(supabase, user, { ...viewing, status }, conv, timeZone.slice(0, 64));
  }

  // Approving or declining flips the same inbox chip the proposal raised.
  updateTag(chatTag(user.id));
  refresh();
  return { ok: true, warning };
}

/** An approved viewing without a Google event yet: create it from the caller's calendar. */
export async function syncViewingToGoogleAction(
  viewingId: string,
  conversationId: string,
  timeZone = "Asia/Jerusalem"
): Promise<ViewingResult> {
  if (!UUID_RE.test(viewingId) || !UUID_RE.test(conversationId)) return { ok: false, error: "Could not find the viewing." };
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("viewings").select("*").eq("id", viewingId).maybeSingle();
  const viewing = data as Viewing | null;
  if (!viewing || viewing.conversation_id !== conversationId) return { ok: false, error: "Could not find the viewing." };
  if (viewing.status !== "confirmed") return { ok: false, error: "Only an approved viewing can be added to the calendar." };
  if (viewing.google_event_link) return { ok: true };
  const conv = await myConversation(supabase, conversationId);
  if (!conv) return { ok: false, error: "Could not find this conversation." };
  const warning = await mirrorToGoogle(supabase, user, viewing, conv, timeZone.slice(0, 64));
  refresh();
  return warning ? { ok: false, error: warning } : { ok: true };
}

export async function disconnectGoogleAction(conversationId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase.from("google_tokens").delete().eq("user_id", user.id);
  if (UUID_RE.test(conversationId)) refresh();
}

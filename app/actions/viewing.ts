"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import {
  VIEWING_DURATIONS,
  describeViewing,
  isValidViewingStart,
  viewingWindow,
  type ViewingDuration,
} from "@/lib/calendar";
import { createCalendarEvent, getGoogleConnection } from "@/lib/google";
import type { ConversationSummary, ViewingStatus } from "@/lib/types";

export type ViewingFormState = { error?: string; warning?: string; done?: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requestOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}

/**
 * Propose a viewing inside a chat. Always stored in `viewings`; when the
 * proposer has Google Calendar connected the event is also created there with
 * both participants as attendees (Google emails the invite).
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
  const timeZone = String(formData.get("time_zone") || "Asia/Jerusalem").slice(0, 64);
  const { start, end } = viewingWindow(startsAt, duration);

  // Participant check + listing context in one RLS-scoped call.
  const { data: rows } = await supabase.rpc("my_conversations");
  const conv = ((rows as ConversationSummary[] | null) ?? []).find((c) => c.id === conversationId);
  if (!conv) return { error: "Could not find this conversation." };

  const { data: inserted, error } = await supabase
    .from("viewings")
    .insert({
      conversation_id: conversationId,
      proposed_by: user.id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      note,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: "Could not save the viewing. Please try again." };

  let warning: string | undefined;
  const google = await getGoogleConnection(supabase, user.id);
  if (google) {
    try {
      const { data: partnerEmail } = await supabase.rpc("conversation_partner_email", {
        p_conversation: conversationId,
      });
      const attendees = [...new Set([user.email, partnerEmail].filter((e): e is string => typeof e === "string" && e.length > 0))];
      const origin = await requestOrigin();
      const copy = describeViewing(
        { title: conv.listing_title, address: conv.listing_address, city: conv.listing_city, rent: conv.listing_rent },
        conv.other_name ?? "your NestUp contact",
        note,
        origin ? `${origin}/chat/${conversationId}` : undefined
      );
      const event = await createCalendarEvent(google.accessToken, { ...copy, start, end, timeZone, attendees });
      await supabase
        .from("viewings")
        .update({ google_event_id: event.id, google_event_link: event.htmlLink })
        .eq("id", inserted.id);
    } catch {
      warning = "Saved the viewing, but Google Calendar did not accept the event.";
    }
  }

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/chat");
  return { done: Date.now(), warning };
}

const RESPONSES: ViewingStatus[] = ["confirmed", "declined", "cancelled"];

/** Confirm / decline (other participant) or cancel (proposer). RLS limits it to participants. */
export async function respondViewingAction(
  viewingId: string,
  status: ViewingStatus,
  conversationId: string
): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(viewingId) || !UUID_RE.test(conversationId) || !RESPONSES.includes(status)) {
    return { ok: false };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.from("viewings").update({ status }).eq("id", viewingId);
  if (error) return { ok: false };
  revalidatePath(`/chat/${conversationId}`);
  return { ok: true };
}

export async function disconnectGoogleAction(conversationId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase.from("google_tokens").delete().eq("user_id", user.id);
  if (UUID_RE.test(conversationId)) revalidatePath(`/chat/${conversationId}`);
}

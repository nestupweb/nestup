"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { findOrCreateConversation, markConversationRead } from "@/lib/chat";
import { messageSchema } from "@/lib/validation/message";
import type { SwipeDirection } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Persist one decision from the deck. Returns instead of redirecting so the
 * client can animate straight into the next room; a like also lands in
 * Profile › Liked (`saved_listings`) so the two hearts agree.
 */
export async function recordSwipeAction(
  listingId: string,
  direction: SwipeDirection
): Promise<{ ok: boolean }> {
  if (!UUID.test(listingId) || (direction !== "like" && direction !== "skip")) return { ok: false };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("swipes")
    .upsert({ seeker_id: user.id, listing_id: listingId, direction }, { onConflict: "seeker_id,listing_id" });
  if (error) return { ok: false };
  if (direction === "like") {
    await supabase
      .from("saved_listings")
      .upsert({ user_id: user.id, listing_id: listingId }, { onConflict: "user_id,listing_id" });
    // No revalidatePath here: /profile is rendered on demand anyway, and a
    // revalidation would refresh /swipe's props mid-deck.
  }
  return { ok: true };
}

/**
 * The optional "say hi" after a like: opens (or reuses) the seeker's thread
 * with the room's household and posts the message. RLS keeps this to active
 * listings the seeker doesn't own.
 */
export async function sendIntroAction(
  listingId: string,
  content: string
): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  if (!UUID.test(listingId)) return { ok: false, error: "This room is no longer available." };
  const parsed = messageSchema.safeParse({ content });
  if (!parsed.success) return { ok: false, error: "Write a short message first (up to 2000 characters)." };

  const { supabase, user } = await requireUser();
  const conversation = await findOrCreateConversation(supabase, listingId, user.id);
  if (!conversation) return { ok: false, error: "This room can't receive messages right now." };

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: user.id,
    content: parsed.data.content,
  });
  if (error) return { ok: false, error: "Could not send the message. Please try again." };

  await markConversationRead(supabase, conversation.id);
  return { ok: true, conversationId: conversation.id };
}

/** Remembers the seeker's own default hello (Profile › Swipe › Default hello message). */
export async function saveIntroTemplateAction(template: string): Promise<{ ok: boolean }> {
  const value = String(template ?? "").trim();
  if (value.length > 500) return { ok: false };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profile_details")
    .upsert({ user_id: user.id, intro_template: value, updated_at: new Date().toISOString() });
  return { ok: !error };
}

/** Form-action variant used by the listing page's "I'm interested" button. */
export async function swipeAction(listingId: string, direction: SwipeDirection): Promise<void> {
  await recordSwipeAction(listingId, direction);
  redirect("/swipe");
}

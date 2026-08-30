import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthContext } from "@/lib/auth";
import type { Conversation, ConversationSummary } from "@/lib/types";

/**
 * Inbox rows for the signed-in user (empty for anonymous). RLS-scoped by the
 * SQL function; memoized per request so the chat layout and thread page share one call.
 *
 * Chats the member deleted are still in here — the thread page looks a
 * conversation up by id through this call, and re-opening a deleted chat from
 * its listing has to land on an empty thread rather than a 404. The inbox list
 * itself goes through `visibleConversations`.
 */
export const getConversations = cache(async (): Promise<ConversationSummary[]> => {
  const { supabase, user } = await getAuthContext();
  if (!user) return [];
  const { data } = await supabase.rpc("my_conversations");
  const rows = (data as ConversationSummary[] | null) ?? [];
  return rows.map((r) => ({ ...r, unread_count: Number(r.unread_count) }));
});

/**
 * What the Chats list shows: everything except a chat this member deleted that
 * has had nothing new said in it since. One message from the other side (or
 * from the member) puts the row straight back, WhatsApp-style.
 */
export function visibleConversations(rows: ConversationSummary[]): ConversationSummary[] {
  return rows.filter((c) => !c.cleared_at || c.last_message_at);
}

/**
 * The badge on the Chat tab. Never rejects: the layouts hand this promise
 * straight to `BottomNav` without awaiting it (so the shell paints first), and
 * an unawaited rejection would take down the whole page for a number that is
 * decoration. A failure just means no badge.
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const { supabase, user } = await getAuthContext();
    if (!user) return 0;
    const { data } = await supabase.rpc("my_unread_count");
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Load or lazily create the (listing, seeker) thread. A concurrent request may
 * win the unique-constraint race, so an insert failure falls back to re-reading.
 * Returns null when RLS blocks the insert (paused listing, own listing).
 */
export async function findOrCreateConversation(
  supabase: SupabaseClient,
  listingId: string,
  seekerId: string
): Promise<Conversation | null> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("listing_id", listingId)
    .eq("seeker_id", seekerId)
    .maybeSingle();
  if (existing) return existing as Conversation;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ listing_id: listingId, seeker_id: seekerId })
    .select()
    .single();
  if (!error && created) return created as Conversation;

  const { data: raced } = await supabase
    .from("conversations")
    .select("*")
    .eq("listing_id", listingId)
    .eq("seeker_id", seekerId)
    .maybeSingle();
  return (raced as Conversation | null) ?? null;
}

/**
 * Stamp "read up to now" for the caller on one conversation. The database
 * picks the timestamp so a message inserted the same instant still counts as read.
 */
/**
 * WhatsApp's "Delete chat": stamp a cutoff for the caller alone. Nothing is
 * deleted for the other side, and the database picks the timestamp.
 */
export async function clearConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase.rpc("clear_conversation", { p_conversation: conversationId });
  return !error;
}

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
}

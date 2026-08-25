import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthContext } from "@/lib/auth";
import type { Conversation, ConversationSummary } from "@/lib/types";

/**
 * Inbox rows for the signed-in user (empty for anonymous). RLS-scoped by the
 * SQL function; memoized per request so the chat layout and thread page share one call.
 */
export const getConversations = cache(async (): Promise<ConversationSummary[]> => {
  const { supabase, user } = await getAuthContext();
  if (!user) return [];
  const { data } = await supabase.rpc("my_conversations");
  const rows = (data as ConversationSummary[] | null) ?? [];
  return rows.map((r) => ({ ...r, unread_count: Number(r.unread_count) }));
});

export async function getUnreadCount(): Promise<number> {
  const { supabase, user } = await getAuthContext();
  if (!user) return 0;
  const { data } = await supabase.rpc("my_unread_count");
  return Number(data ?? 0);
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
export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
}

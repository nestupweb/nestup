import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthContext } from "@/lib/auth";
import { chatTag } from "@/lib/cache-tags";
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
 * The same inbox rows, cached in the member's own browser.
 *
 * This is what stops Chat painting a skeleton on every single visit. Swipe,
 * Listings and Profile were all cached; Chat was deliberately left out on the
 * grounds that a stale window could hide a message that had just arrived. That
 * trade is not actually forced — the stale window only hides a message if
 * nothing tells the cache a message landed, and `ChatRealtime` is already
 * subscribed to exactly that event. So the inbox is cached and
 * `syncChatAction` drops `chatTag` the moment the socket fires, which gives
 * both halves: instant on return, and current within a round-trip of any
 * message, from either side.
 *
 * `use cache: private`, never the shared `use cache`: these rows are one
 * member's conversations, the other participant's name and photo, and their
 * unread counts. A private cache lives only in the requesting browser, and
 * `userId` keys the entry inside it, so a second member signing in to the same
 * browser cannot hit the first one's inbox.
 *
 * Note what is NOT cached: the messages themselves. The thread page reads
 * those fresh on every render (see `chat/[id]/page.tsx`), because that is the
 * surface where "one message behind" is actually visible to someone typing.
 * The inbox is a list of who and when — cheap to refresh, costly to re-fetch
 * on every tab tap.
 */
export async function getCachedInbox(): Promise<{ conversations: ConversationSummary[]; meId: string }> {
  "use cache: private";
  // stale >= 300 is the threshold that lets this ride along in the route's App
  // Shell, so the prefetched Chat tab arrives with the inbox already in it
  // rather than a hole behind the skeleton. See `cacheLife` prerendering rules.
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });

  // The session is read INSIDE the cache scope, and that is the whole point of
  // the shape of this function.
  //
  // It used to take `userId`, which meant the caller had to `await
  // requireUser()` first — an uncached `auth.getUser()` round-trip sitting in
  // front of the cached read. The App Shell prerender advances through cached
  // reads and stops at the first uncached one, so that one call was enough to
  // keep the whole inbox out of the shell: the tab still painted its skeleton
  // and streamed the list in after the click, exactly as if none of this were
  // cached. Measured on the live site, that was ~900ms with a skeleton on every
  // single visit to Chat.
  //
  // With the read in here, a cache hit does no uncached work at all, so the
  // shell can carry it. `auth.getUser()` still runs on a miss.
  //
  // Access is not weakened by dropping the caller's `requireUser()`:
  //  - `proxy.ts` gates /chat at the edge on every request, uncached;
  //  - both pages under this layout still call `requireUser()` themselves, so
  //    a suspension landing mid-session still closes the app immediately —
  //    that check is deliberately NOT cached anywhere;
  //  - `my_conversations` is RLS-scoped, so this returns only rows the
  //    session may see, and an anonymous session gets none.
  const { user } = await getAuthContext();
  if (!user) return { conversations: [], meId: "" };
  cacheTag(chatTag(user.id));
  return { conversations: await getConversations(), meId: user.id };
}

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

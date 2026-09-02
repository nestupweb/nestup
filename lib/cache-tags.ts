/**
 * Every cache tag in the app, in one place.
 *
 * The point of tags here is blast radius. The actions used to answer any
 * mutation with a fistful of `revalidatePath` calls — saving a listing
 * rebuilt `/listing`, `/browse`, `/profile`, `/swipe` AND `/chat` — so editing
 * a room threw away the member's chats and profile too. A tag names one thing,
 * so a write can invalidate exactly what it changed.
 *
 * Keep readers and writers on these helpers rather than raw strings: a
 * typo in either half fails silently, as either a cache that never clears or
 * one that never hits.
 */

/** The public room list (Listings index). Shared across everyone. */
export const LISTINGS_TAG = "listings";

/** One room's own page. */
export const listingTag = (listingId: string) => `listing:${listingId}`;

/** A member's Profile tab data: their rooms, saved rooms, history, invites. */
export const profileTag = (userId: string) => `profile:${userId}`;

/** A member's Swipe deck — who they have and haven't seen. */
export const deckTag = (userId: string) => `deck:${userId}`;

/** A member's saved ("liked") room ids, which the Listings hearts read. */
export const savedTag = (userId: string) => `saved:${userId}`;

/**
 * A member's Chat inbox — the conversation rows behind the Chats list.
 *
 * Chat is the one feature where a cache has to be invalidated by *someone
 * else's* write: a message from the other side changes this member's inbox,
 * and no server action of theirs runs to clear it. That is what
 * `ChatRealtime` is wired to — the socket event calls `syncChatAction`, which
 * drops this tag in the receiving browser and re-renders. So the inbox is
 * cached (instant on every visit) without ever being stale after a message
 * lands, which is what kept it uncached before.
 */
export const chatTag = (userId: string) => `chat:${userId}`;

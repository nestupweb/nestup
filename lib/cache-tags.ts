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

/**
 * This browser's signed-in identity: who they are, and whether they are
 * suspended. Cached by `getCachedSession` in `lib/auth.ts`.
 *
 * Unlike every other tag here it carries no user id, and it does not need one:
 * `use cache: private` already scopes the entry to one browser, and the whole
 * point of this tag is the moment when we do not yet know who the member is.
 *
 * Dropped whenever a session begins or its identity changes — signing in,
 * confirming a sign-up code, changing an e-mail address. Without that, a
 * visitor who browsed Listings signed out would keep the cached "nobody" for
 * five minutes after logging in, and the site would go on treating them as a
 * visitor. Signing out needs no tag: it forces a full document load, which
 * empties the private cache outright.
 */
export const SESSION_TAG = "session";

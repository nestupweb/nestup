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

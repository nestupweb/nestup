import type { Listing, Profile } from "@/lib/types";

/**
 * Shared listings: the rules and the wording, with no I/O, so the picker, the
 * server action and the tests all read the same sentences.
 *
 * The database (migration 0032) is what actually enforces the cap — everything
 * here is so the member finds out before they press Publish rather than after.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Well-formed ids only, de-duplicated, order kept — junk never reaches the RPC. */
export function cleanIds(raw: readonly unknown[]): string[] {
  const seen = new Set<string>();
  for (const value of raw) {
    const id = String(value ?? "").trim().toLowerCase();
    if (UUID_RE.test(id)) seen.add(id);
  }
  return [...seen];
}

/** Shortest search that runs; one letter matches most of the site. */
export const MIN_MEMBER_QUERY = 2;

/** Rows in the search dropdown. Enough to recognise someone, short enough to scan. */
export const MEMBER_SEARCH_LIMIT = 8;

/**
 * How many roommates the creator may tag.
 *
 * `roommates_count` is the form's "Current roommates" — the people sharing the
 * home *besides* the creator. One of those places is the room being advertised,
 * so it stays untagged and open for the seeker who answers the ad: hence
 * `max_tagged = roommates_count - 1`.
 */
export function maxTaggedRoommates(roommatesCount: number): number {
  if (!Number.isFinite(roommatesCount)) return 0;
  return Math.max(0, Math.trunc(roommatesCount) - 1);
}

/** Null when the tag list fits, else the sentence to show under the picker. */
export function tagCapError(taggedCount: number, roommatesCount: number): string | null {
  const max = maxTaggedRoommates(roommatesCount);
  if (taggedCount <= max) return null;
  if (max === 0) {
    return "Set “Current roommates” to 2 or more before tagging anyone — one room has to stay open for the person moving in.";
  }
  return `You can tag ${max} roommate${max === 1 ? "" : "s"} with ${roommatesCount} current roommates — the last room stays open for the person moving in.`;
}

/** "2 of 3 tagged" — the counter beside the picker. */
export function tagCapHint(taggedCount: number, roommatesCount: number): string {
  const max = maxTaggedRoommates(roommatesCount);
  if (max === 0) return "No room to tag anyone yet";
  return `${taggedCount} of ${max} tagged`;
}

/** The question on the pending card. One sentence, used by the card and its test. */
export function invitePrompt(authorName: string): string {
  const who = authorName.trim() || "A member";
  return `${who} added you to a shared listing. Confirm to join as a co-poster?`;
}

/** Everyone tagged on a listing, with where their invite stands. */
export interface TaggedMember {
  /**
   * Only the search fills this in (0036): it is what separates two members
   * with near-identical names, which nothing else on the row did. The
   * already-tagged list shows an invite's status instead and does not need it.
   */
  email?: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  occupation: string;
  /** Absent for someone the creator has just picked and not yet saved. */
  status?: "pending" | "accepted" | "declined";
}

/** A pending invite, with everything its card needs to render. */
export interface PendingInvite {
  id: string;
  listing: Listing;
  inviter: Pick<Profile, "user_id" | "full_name" | "avatar_url">;
}

/**
 * A `raise exception` from migration 0032, turned into something a member can
 * act on. The database's own wording is written for a log, not a form, and it
 * is the last line of defence rather than the first — anything that reaches
 * here has already slipped past the picker, so the fallback stays vague on
 * purpose rather than guessing.
 */
export function inviteErrorMessage(dbMessage: string): string {
  const m = dbMessage.toLowerCase();
  if (m.includes("at most")) return "You tagged more roommates than there are rooms — untag someone and try again.";
  if (m.includes("blocked")) return "You can’t tag a member you’ve blocked.";
  // 0033: one person, one home. The database names them, so keep the name.
  if (m.includes("already has an active listing")) {
    const who = dbMessage.replace(/ already has an active listing.*/i, "").trim();
    return `${who || "That member"} already has a listing of their own — they can’t join another.`;
  }
  if (m.includes("only the listing owner")) return "Only the member who posted the room can tag roommates.";
  if (m.includes("tagged member not found")) return "One of the people you tagged is no longer a member.";
  if (m.includes("listing not found")) return "That listing is gone.";
  return "Could not save your roommates. Please try again.";
}

/** The same, for the Yes/No card. */
export function respondErrorMessage(dbMessage: string): string {
  const m = dbMessage.toLowerCase();
  if (m.includes("already answered")) return "You’ve already answered this invitation.";
  if (m.includes("you already have an active listing")) {
    return "You already have a listing of your own — take it down first if you want to join this one.";
  }
  if (m.includes("only the invited member")) return "This invitation isn’t yours to answer.";
  if (m.includes("invite not found")) return "That invitation is no longer there.";
  return "Could not save your answer. Please try again.";
}

/**
 * The same refusal as an HTTP status, so the REST routes can stay wrappers
 * rather than each deciding for themselves what "you may not" means. Kept
 * beside the sentences because they are two readings of one refusal and must
 * not drift apart.
 */
export function inviteErrorStatus(dbMessage: string): number {
  const m = dbMessage.toLowerCase();
  if (m.includes("only the listing owner") || m.includes("blocked")) return 403;
  if (m.includes("already has an active listing")) return 409;
  if (m.includes("listing not found") || m.includes("tagged member not found")) return 404;
  if (m.includes("at most")) return 422;
  return 400;
}

export function respondErrorStatus(dbMessage: string): number {
  const m = dbMessage.toLowerCase();
  if (m.includes("only the invited member")) return 403;
  if (m.includes("invite not found")) return 404;
  if (m.includes("already answered") || m.includes("already have an active listing")) return 409;
  return 400;
}

/** How a co-poster's own tag row reads under the picker. */
export function tagStatusLabel(status: TaggedMember["status"]): string {
  if (status === "accepted") return "Joined";
  if (status === "declined") return "Declined";
  if (status === "pending") return "Waiting for their answer";
  return "Will be asked when you publish";
}

/**
 * Whether My Listings offers the "+ Add listing" card.
 *
 * Only a member with no home at all, in any of its three shapes: a room they
 * host, a room they co-post, or an invitation they have not answered yet.
 *
 * The invitation counts because the card was a dead end while one was open.
 * `getManagedListing` hands `/listing` the room a member co-posts when they
 * host none, so "+ Add listing" opened the shared room's edit form instead of a
 * blank one — and a member who accepted after starting a listing of their own
 * would be turned away by `respond_to_listing_invite` ("you already have an
 * active listing", 0033). Answering the invitation first is the only path that
 * goes anywhere, so it is the only one offered; declining brings the card back.
 *
 * Paused and taken rooms count as homes here. They are still yours to re-open,
 * `getManagedListing` still returns them, and the dead end would be identical.
 */
export function canAddListing(state: { own: number; shared: number; invites: number }): boolean {
  return state.own === 0 && state.shared === 0 && state.invites === 0;
}

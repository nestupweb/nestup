import {
  MEMBER_SEARCH_LIMIT,
  UUID_RE,
  cleanIds,
  inviteErrorMessage,
  inviteErrorStatus,
  respondErrorMessage,
  respondErrorStatus,
  type PendingInvite,
  type TaggedMember,
} from "@/lib/co-posters";
import type { Listing, ListingInviteStatus, Profile } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared listings — every database call, in one place.
 *
 * Deliberately NOT a `"use server"` module: the Server Actions and the REST
 * routes both import these, and an exported async function in a `"use server"`
 * file becomes a callable endpoint of its own. Here they stay ordinary
 * server-side functions with one caller-supplied client, so there is exactly
 * one code path to the rules in migration 0032 and exactly one place to change
 * them.
 *
 * Nothing below re-checks who may do what. `invite_listing_roommates` and
 * `respond_to_listing_invite` are security definer, run under the caller's own
 * `auth.uid()`, and refuse anything they shouldn't — these wrappers only turn
 * their exceptions into sentences.
 */

/**
 * Reconcile a listing's tagged roommates to exactly `ids`: new ids are asked,
 * dropped ids lose their invitation and their co-poster row, and anyone who
 * already answered keeps their answer.
 *
 * Returns how many invitations are still waiting.
 */
export async function inviteRoommates(
  supabase: SupabaseClient,
  listingId: string,
  ids: readonly unknown[]
): Promise<{ pending?: number; error?: string; status?: number }> {
  if (!UUID_RE.test(String(listingId ?? ""))) {
    return { error: "Could not tell which listing to tag.", status: 400 };
  }
  const { data, error } = await supabase.rpc("invite_listing_roommates", {
    p_listing: listingId,
    p_invitees: cleanIds(ids),
  });
  if (error) {
    const message = error.message ?? "";
    return { error: inviteErrorMessage(message), status: inviteErrorStatus(message) };
  }
  return { pending: typeof data === "number" ? data : 0 };
}

/** Yes or No on one invitation. Returns the listing it was about. */
export async function respondToInvite(
  supabase: SupabaseClient,
  inviteId: string,
  accept: boolean
): Promise<{ listingId?: string; error?: string; status?: number }> {
  if (!UUID_RE.test(String(inviteId ?? ""))) {
    return { error: "Could not tell which invitation that was.", status: 400 };
  }
  const { data, error } = await supabase.rpc("respond_to_listing_invite", {
    p_invite: inviteId,
    p_accept: accept,
  });
  if (error) {
    const message = error.message ?? "";
    return { error: respondErrorMessage(message), status: respondErrorStatus(message) };
  }
  return { listingId: typeof data === "string" ? data : undefined };
}

/**
 * Members the tag picker may offer: name match, not blocked either way, and no
 * home of their own (0033).
 *
 * One RPC rather than a query plus a TypeScript filter, because the three rules
 * have to be applied *before* the limit — filtering a capped page discarded
 * almost everything once most members were housed, and the picker showed two
 * people where four matched. `search_available_members` (0034) does all of it
 * in one pass; `exceptListing` keeps the room being edited from disqualifying
 * its own roommates.
 */
export async function searchAvailableMembers(
  supabase: SupabaseClient,
  query: string,
  exceptListing?: string,
  limit = MEMBER_SEARCH_LIMIT
): Promise<TaggedMember[]> {
  const { data, error } = await supabase.rpc("search_available_members", {
    p_query: query,
    p_listing: UUID_RE.test(String(exceptListing ?? "")) ? exceptListing : null,
    p_limit: limit,
  });
  if (error) return [];
  return (data as TaggedMember[] | null) ?? [];
}

/**
 * The one room this member manages: the one they posted, or — failing that —
 * the one they co-post. Since 0033 a confirmed roommate edits the same record
 * the creator does, so the listing form has to find it for either of them.
 */
export async function getManagedListing(
  supabase: SupabaseClient,
  userId: string
): Promise<Listing | null> {
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const own = (data as Listing | null) ?? null;
  if (own) return own;

  const shared = await getCoPostedListings(supabase, userId);
  return shared[0] ?? null;
}

type InviteJoin = {
  id: string;
  status: ListingInviteStatus;
  created_at: string;
  listings: Listing | null;
  inviter: Pick<Profile, "user_id" | "full_name" | "avatar_url"> | null;
};

/**
 * The member's unanswered invitations, newest first — the cards at the top of
 * My Listings. A room its owner has deleted is left out: `removed_at` means
 * gone everywhere, and there is nothing left to join.
 */
export async function getPendingInvites(supabase: SupabaseClient, userId: string): Promise<PendingInvite[]> {
  const { data } = await supabase
    .from("listing_invites")
    .select("id, status, created_at, listings(*), inviter:profiles!listing_invites_inviter_id_fkey(user_id, full_name, avatar_url)")
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return ((data as unknown as InviteJoin[] | null) ?? [])
    .filter((row) => row.listings && !row.listings.removed_at && row.inviter)
    .map((row) => ({ id: row.id, listing: row.listings as Listing, inviter: row.inviter as PendingInvite["inviter"] }));
}

/**
 * Rooms this member co-posts — the ones they said Yes to. Their own listings
 * are excluded: those already have their own section, with the owner's
 * buttons on them.
 */
export async function getCoPostedListings(supabase: SupabaseClient, userId: string): Promise<Listing[]> {
  const { data: rows } = await supabase
    .from("listing_residents")
    .select("listing_id")
    .eq("resident_id", userId);
  const ids = ((rows as { listing_id: string }[] | null) ?? []).map((r) => r.listing_id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("listings")
    .select("*")
    .in("id", ids)
    .neq("owner_id", userId)
    .is("removed_at", null)
    .order("created_at", { ascending: false });
  return (data as Listing[] | null) ?? [];
}

type TagJoin = {
  status: ListingInviteStatus;
  profiles: Pick<Profile, "user_id" | "full_name" | "avatar_url" | "occupation"> | null;
};

/**
 * Who is already tagged on a listing, so re-opening the form shows the picker
 * as the creator left it — with each person's answer beside their name.
 */
export async function getTaggedMembers(supabase: SupabaseClient, listingId: string): Promise<TaggedMember[]> {
  if (!UUID_RE.test(String(listingId ?? ""))) return [];
  const { data } = await supabase
    .from("listing_invites")
    .select("status, profiles!listing_invites_invitee_id_fkey(user_id, full_name, avatar_url, occupation)")
    .eq("listing_id", listingId)
    .order("created_at");

  return ((data as unknown as TagJoin[] | null) ?? [])
    .filter((row) => row.profiles)
    .map((row) => ({ ...(row.profiles as NonNullable<TagJoin["profiles"]>), status: row.status }));
}

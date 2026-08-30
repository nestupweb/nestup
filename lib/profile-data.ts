import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileTag } from "@/lib/cache-tags";
import { getCoPostedListings, getPendingInvites } from "@/lib/invites";
import type { Listing, ProfileDetails } from "@/lib/types";
import type { TaggedMember } from "@/lib/co-posters";

/** One row of a Profile tab: a room plus the caption that tab wants on it. */
export type ProfileTabItem = { listing: Listing; caption?: string; saved?: boolean };

export type ProfileTabData = {
  mine: ProfileTabItem[];
  liked: ProfileTabItem[];
  history: ProfileTabItem[];
  details: ProfileDetails | null;
  invites: Awaited<ReturnType<typeof getPendingInvites>>;
  shared: Awaited<ReturnType<typeof getCoPostedListings>>;
};

type JoinedRow<K extends string> = { [P in K]: string } & { listings: Listing | null };

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Everything the Profile tabs render, as one cached read.
 *
 * This is the page's whole cost — six round-trips, two of them serial inside
 * `getCoPostedListings` — and none of it changes unless this member does
 * something. Caching it is what makes returning to the Profile tab instant.
 *
 * `use cache: private`, never the shared `use cache`: every row here belongs to
 * one member (their rooms, what they liked, what they viewed, their pending
 * invites). A private cache is held in that member's own browser and never
 * written to a store another request could read, so there is no key to get
 * wrong and no way for one member's profile to be served to another. `userId`
 * is still an argument so the entry is keyed per member even within one browser
 * — signing out and in as someone else cannot hit the previous entry.
 *
 * Invalidated by `profileTag(userId)` from the actions that change any of it:
 * saving/pausing/deleting a room, hearting one, answering an invite.
 */
export async function getProfileTabData(userId: string): Promise<ProfileTabData> {
  "use cache: private";
  cacheTag(profileTag(userId));
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const supabase = await createClient();
  const [mineRes, likedRes, historyRes, detailsRes, invites, shared] = await Promise.all([
    supabase
      .from("listings")
      .select("*")
      .eq("owner_id", userId)
      .is("removed_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_listings")
      .select("created_at, listings(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("listing_views")
      .select("viewed_at, listings(*)")
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false })
      .limit(30),
    supabase.from("profile_details").select("*").eq("user_id", userId).maybeSingle(),
    // Shared listings: what is waiting on an answer, and what they already
    // said yes to (migration 0032).
    getPendingInvites(supabase, userId),
    getCoPostedListings(supabase, userId),
  ]);

  const mine: ProfileTabItem[] = ((mineRes.data as Listing[] | null) ?? []).map((listing) => ({ listing }));
  // A room its owner deleted leaves Liked and History too — the chats about it
  // survive, the room itself does not.
  const liked: ProfileTabItem[] = ((likedRes.data as unknown as JoinedRow<"created_at">[] | null) ?? [])
    .filter((r) => r.listings && !(r.listings as Listing).removed_at)
    .map((r) => ({ listing: r.listings as Listing, caption: `Liked ${shortDate(r.created_at)}` }));
  const likedIds = new Set(liked.map((i) => i.listing.id));
  const history: ProfileTabItem[] = ((historyRes.data as unknown as JoinedRow<"viewed_at">[] | null) ?? [])
    .filter((r) => r.listings && !(r.listings as Listing).removed_at)
    .map((r) => ({
      listing: r.listings as Listing,
      caption: `Viewed ${shortDate(r.viewed_at)}`,
      saved: likedIds.has((r.listings as Listing).id),
    }));

  return {
    mine,
    liked,
    history,
    details: (detailsRes.data as ProfileDetails | null) ?? null,
    invites,
    shared,
  };
}

export type { TaggedMember };

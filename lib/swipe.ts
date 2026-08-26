import { renderIntro } from "@/lib/swipe-intro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lifestyleScore, socialScore, sortKey } from "@/lib/compatibility";
import type { Listing, Profile } from "@/lib/types";

/** One card in the swipe deck: the room, who lives there, and the seeker's scores for it. */
export interface DeckEntry {
  listing: Listing;
  owner: Profile;
  residents: Profile[];
  lifestyle: number;
  social: number | null;
}

export const DECK_SIZE = 60;

/**
 * Only high-matching rooms make the deck: the combined score (`sortKey`) must
 * reach the "Good" band of `scoreLabel`. Lower-scoring rooms stay reachable
 * through Browse, so nothing is hidden from the seeker entirely.
 */
export const MIN_DECK_SCORE = 60;

/**
 * Hard filters before any scoring (user decision, 2026-08-26): the deck shows
 * only rooms in the seeker's preferred cities and inside their budget. A
 * preference that isn't set doesn't filter — no cities means any city, no
 * max means any rent. Rooms outside stay reachable through Browse.
 */
export function fitsHardFilters(seeker: Profile, listing: Listing): boolean {
  if (seeker.preferred_cities.length > 0 && !seeker.preferred_cities.includes(listing.city)) return false;
  if (seeker.budget_max > 0 && listing.rent > seeker.budget_max) return false;
  if (seeker.budget_min > 0 && listing.rent < seeker.budget_min) return false;
  return true;
}

/**
 * Pure ranking step: drop rooms outside the seeker's cities / budget
 * (`fitsHardFilters`), attach owners/residents, score from the seeker's
 * questionnaire, keep only rooms at or above `MIN_DECK_SCORE`, sort best-fit
 * first. A listing whose owner profile is unavailable can't be scored and is
 * skipped.
 */
export function buildDeck(
  seeker: Profile,
  listings: Listing[],
  owners: Profile[],
  residents: { listing_id: string; profile: Profile | null }[]
): DeckEntry[] {
  const ownerById = new Map(owners.map((p) => [p.user_id, p]));
  const residentsByListing = new Map<string, Profile[]>();
  for (const r of residents) {
    if (!r.profile) continue;
    const list = residentsByListing.get(r.listing_id) ?? [];
    list.push(r.profile);
    residentsByListing.set(r.listing_id, list);
  }

  const entries: DeckEntry[] = [];
  for (const listing of listings) {
    if (!fitsHardFilters(seeker, listing)) continue;
    const owner = ownerById.get(listing.owner_id);
    if (!owner) continue;
    const roommates = (residentsByListing.get(listing.id) ?? []).filter(
      (p) => p.user_id !== owner.user_id
    );
    const lifestyle = lifestyleScore(seeker, listing, owner, "seeker");
    const social = socialScore(seeker, owner);
    if (sortKey(lifestyle, social) < MIN_DECK_SCORE) continue;
    entries.push({ listing, owner, residents: roommates, lifestyle, social });
  }
  return entries.sort(
    (a, b) => sortKey(b.lifestyle, b.social) - sortKey(a.lifestyle, a.social)
  );
}

/**
 * Format a date-only ISO string ("2026-10-01") without timezone drift:
 * parsed as a calendar date, so server and client render the same text.
 */
export function formatMoveIn(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The ready-made hello offered after a like — the seeker's saved template
 * (or the built-in one) with {name} filled in. See `lib/swipe-intro.ts`.
 */
export function introMessage(entry: DeckEntry, template = ""): string {
  return renderIntro(template, entry.owner.full_name);
}

/** Interests two people share, in the seeker's order. */
export function sharedInterests(a: Profile, b: Profile): string[] {
  const theirs = new Set(b.interests);
  return a.interests.filter((i) => theirs.has(i));
}

/**
 * Active rooms the seeker hasn't swiped on yet (and doesn't own), limited to
 * high matches (see `MIN_DECK_SCORE`) and ranked by compatibility. Owners and
 * extra roommates come along for the third panel.
 */
export async function getSwipeDeck(supabase: SupabaseClient, seeker: Profile): Promise<DeckEntry[]> {
  const [{ data: swiped }, { data: listingRows }] = await Promise.all([
    supabase.from("swipes").select("listing_id").eq("seeker_id", seeker.user_id),
    supabase
      .from("listings")
      .select("*")
      .eq("is_active", true)
      .neq("owner_id", seeker.user_id)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const seen = new Set((swiped ?? []).map((r) => r.listing_id as string));
  const listings = ((listingRows as Listing[] | null) ?? []).filter((l) => !seen.has(l.id));
  if (listings.length === 0) return [];

  const ownerIds = [...new Set(listings.map((l) => l.owner_id))];
  const listingIds = listings.map((l) => l.id);
  const [{ data: owners }, { data: residentRows }] = await Promise.all([
    supabase.from("profiles").select("*").in("user_id", ownerIds),
    supabase.from("listing_residents").select("listing_id, profiles(*)").in("listing_id", listingIds),
  ]);

  const residents = (
    (residentRows as unknown as { listing_id: string; profiles: Profile | null }[] | null) ?? []
  ).map((r) => ({ listing_id: r.listing_id, profile: r.profiles }));
  return buildDeck(seeker, listings, (owners as Profile[] | null) ?? [], residents).slice(0, DECK_SIZE);
}

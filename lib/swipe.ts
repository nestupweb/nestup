import { renderIntro } from "@/lib/swipe-intro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInterest, rankByAffinity, type DwellRow, type InterestVector } from "@/lib/affinity";
import { lifestyleScore, socialScore, sortKey } from "@/lib/compatibility";
import { getBlockedIds } from "@/lib/moderation";
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
 * only rooms in the seeker's preferred cities and inside their budget, and
 * only rooms that satisfy both gender rules (2026-08-29). A preference that
 * isn't set doesn't filter — no cities means any city, no max means any rent.
 * Rooms outside stay reachable through Browse.
 */
export function fitsHardFilters(seeker: Profile, listing: Listing): boolean {
  if (seeker.preferred_cities.length > 0 && !seeker.preferred_cities.includes(listing.city)) return false;
  if (seeker.budget_max > 0 && listing.rent > seeker.budget_max) return false;
  if (seeker.budget_min > 0 && listing.rent < seeker.budget_min) return false;
  return passesGenderRules(seeker, listing);
}

/**
 * The two gender rules, both strict, both cutting rooms out of the deck rather
 * than scoring them down (migration 0037).
 *
 *   "Same gender as me"    — the seeker's side. Ticked, they see only rooms
 *                            where EVERY household member shares their exact
 *                            gender. `household_gender` is already null when
 *                            the household is mixed or when one of them hasn't
 *                            said, and both of those are "no".
 *   `wanted_gender`        — the room's side. "Only" has to mean only, so a
 *                            room that asks for one gender reaches nobody else
 *                            — including a seeker who hasn't stated one, since
 *                            we cannot say they qualify.
 *
 * A seeker who ticked the box without stating their own gender has asked for
 * something unanswerable; the preference is skipped rather than emptying their
 * deck, and the profile form is where that gets fixed.
 */
export function passesGenderRules(seeker: Profile, listing: Listing): boolean {
  if (listing.wanted_gender && seeker.gender !== listing.wanted_gender) return false;
  if (seeker.pref_same_gender && seeker.gender && listing.household_gender !== seeker.gender) return false;
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
  // The seeker's cities and budget are applied in the query, not afterwards.
  // They used to be filtered in `buildDeck` alone, over the newest 300 rooms —
  // which was fine at 155 listings and became a bug at 490: the newest 300 were
  // all small-town rooms, so a Tel Aviv seeker's own city fell out of the
  // window entirely and the deck came up empty (2026-08-27).
  let query = supabase
    .from("listings")
    .select("*")
    .eq("is_active", true)
    .is("removed_at", null)
    .neq("owner_id", seeker.user_id);
  if (seeker.preferred_cities.length > 0) query = query.in("city", seeker.preferred_cities);
  if (seeker.budget_max > 0) query = query.lte("rent", seeker.budget_max);
  if (seeker.budget_min > 0) query = query.gte("rent", seeker.budget_min);

  const [{ data: swiped }, { data: listingRows }] = await Promise.all([
    supabase.from("swipes").select("listing_id").eq("seeker_id", seeker.user_id),
    query.order("created_at", { ascending: false }).limit(300),
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

  // Migration 0030 already hides a room whose OWNER is blocked, in both
  // directions and for every reader. A room where a blocked member is only a
  // roommate still comes back, though, so drop those here: "must not appear in
  // each other's Swipe" is about the person, not about who signed the lease.
  const hidden = await getBlockedIds(supabase);
  const visibleListings = hidden.size
    ? listings.filter(
        (l) =>
          !hidden.has(l.owner_id) &&
          !residents.some((r) => r.listing_id === l.id && r.profile && hidden.has(r.profile.user_id))
      )
    : listings;

  return buildDeck(seeker, visibleListings, (owners as Profile[] | null) ?? [], residents).slice(0, DECK_SIZE);
}

/** What the deck needs to keep personalising while the seeker is still swiping. */
export interface PersonalisedDeck {
  entries: DeckEntry[];
  /** The seeker's learned taste; `{}` until they have looked at anything. */
  interest: InterestVector;
  /** How many rooms that taste is built from — the ranker's confidence. */
  events: number;
}

/**
 * The deck, re-ordered by how much attention the seeker has paid to rooms like
 * each one (`lib/affinity.ts`).
 *
 * Personalisation runs strictly *after* `getSwipeDeck`, which is what keeps the
 * guarantee simple: the hard filters and the `MIN_DECK_SCORE` gate have already
 * chosen the rooms, and this can only change the order they arrive in. A failed
 * or empty attention history degrades to exactly today's compatibility ordering.
 *
 * The rooms the taste is built from are read separately from the deck, because
 * a room the seeker lingered on has usually been swiped away by now and so is
 * deliberately absent from `entries`.
 */
export async function getPersonalisedDeck(
  supabase: SupabaseClient,
  seeker: Profile
): Promise<PersonalisedDeck> {
  const [entries, { data: dwellRows }] = await Promise.all([
    getSwipeDeck(supabase, seeker),
    supabase
      .from("listing_dwell")
      .select("listing_id, dwell_ms, photos_seen, pages_seen")
      .eq("user_id", seeker.user_id)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  const rows = (dwellRows as DwellRow[] | null) ?? [];
  if (rows.length === 0) return { entries, interest: {}, events: 0 };

  const { data: seenListings } = await supabase
    .from("listings")
    .select("*")
    .in("id", rows.map((r) => r.listing_id));

  const byId = new Map(((seenListings as Listing[] | null) ?? []).map((l) => [l.id, l]));
  const interest = buildInterest(rows, byId);
  const events = rows.filter((r) => byId.has(r.listing_id)).length;
  return { entries: rankByAffinity(entries, interest, events), interest, events };
}

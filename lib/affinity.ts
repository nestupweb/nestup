import { sortKey } from "@/lib/compatibility";
import type { DeckEntry } from "@/lib/swipe";
import type { Listing } from "@/lib/types";

/**
 * Attention-based personalisation for the swipe deck.
 *
 * Everything here is pure: given the rooms a seeker lingered on, produce a
 * small ordering bonus for the rooms they haven't seen yet. Nothing in this
 * file talks to the database or the browser, which is what makes the whole
 * feature unit-testable (see tests/unit/affinity.test.ts).
 *
 * The one rule that matters: this NEVER admits a room to the deck and never
 * removes one. `buildDeck` has already applied the hard filters and dropped
 * everything below `MIN_DECK_SCORE` by the time any of this runs, so
 * personalisation can only reorder rooms the seeker already qualified for.
 * The bonus is clamped to ±`MAX_BONUS` on a 0–100 scale for the same reason:
 * a room may climb within its band, but a merely-good room can never overtake
 * a great one on the strength of a long look.
 */

/** Dwell above this counts as "as interested as it gets" — see `engagement`. */
const DWELL_FULL_MS = 20_000;
/** Matches the CHECK constraint in migration 0035 and the client-side cap. */
export const DWELL_CAP_MS = 45_000;
/** Below this the reading is noise (a mis-tap, a card passed through). */
export const DWELL_FLOOR_MS = 1_500;

/** Rooms a seeker must have looked at before ranking shifts at all. */
export const MIN_EVENTS = 3;
/** Full confidence at this many rooms; below it the bonus is scaled down. */
const FULL_CONFIDENCE_EVENTS = 12;
/** Largest ordering nudge, on the same 0–100 scale as `sortKey`. */
export const MAX_BONUS = 8;

/**
 * Engagement is scored around this, not around zero: a room the seeker barely
 * looked at should push its features *away*, not merely fail to pull them in.
 */
const NEUTRAL_ENGAGEMENT = 0.45;

export interface DwellRow {
  listing_id: string;
  dwell_ms: number;
  photos_seen: number;
  pages_seen: number;
}

/** A sparse bag of binary features. Absent key = feature not present. */
export type FeatureVector = Record<string, number>;
/** Learned per-seeker taste: positive weight = liked, negative = avoided. */
export type InterestVector = Record<string, number>;

/** Rent bucketed to ₪500 — the useful signal is "around this price", not the exact shekel. */
function rentBucket(rent: number): number {
  return Math.round(rent / 500) * 500;
}

/**
 * The room as a set of binary features. Deliberately coarse: buckets and flags
 * generalise across a small catalogue, where exact values would make every room
 * its own category and nothing would ever look similar to anything else.
 */
export function featureVector(listing: Listing): FeatureVector {
  const v: FeatureVector = {
    [`city:${listing.city}`]: 1,
    [`type:${listing.property_type}`]: 1,
    [`lease:${listing.lease_term}`]: 1,
    [`rent:${rentBucket(listing.rent)}`]: 1,
    [`rooms:${listing.rooms}`]: 1,
    [`roommates:${Math.min(listing.household_size, 5)}`]: 1,
  };
  if (listing.neighborhood) v[`area:${listing.neighborhood}`] = 1;
  if (listing.size_sqm) v[`size:${Math.round(listing.size_sqm / 20) * 20}`] = 1;
  for (const key of [
    "balcony", "air_conditioning", "parking", "elevator", "furnished", "pets_allowed", "smoking_allowed",
  ] as const) {
    if (listing[key]) v[`has:${key}`] = 1;
  }
  if (listing.safe_room !== "none") v[`safe:${listing.safe_room}`] = 1;
  // Photo similarity, cheaply: the owner already labels each photo by room, so
  // "this listing shows a balcony and a kitchen" is available without putting a
  // vision model on the critical path. True visual similarity is out of scope.
  for (const label of new Set(listing.photo_labels ?? [])) {
    if (label) v[`photo:${label}`] = 1;
  }
  return v;
}

/**
 * How interested one reading suggests the seeker was, 0–1. Time carries most of
 * it, but deliberate navigation — flipping photos, opening the info pages —
 * corroborates, because a clock alone cannot tell interest from hesitation.
 */
export function engagement(row: DwellRow): number {
  const time = Math.min(1, Math.min(row.dwell_ms, DWELL_CAP_MS) / DWELL_FULL_MS);
  const photos = Math.min(1, row.photos_seen / 4);
  const pages = Math.min(1, row.pages_seen / 3);
  return 0.55 * time + 0.25 * photos + 0.2 * pages;
}

/**
 * The seeker's taste so far: every room they looked at, pulling its features
 * toward them in proportion to how far its engagement sat above or below
 * neutral. Rooms not present in `listings` are skipped — a room can be removed
 * after it was seen.
 */
export function buildInterest(rows: DwellRow[], listings: Map<string, Listing>): InterestVector {
  const interest: InterestVector = {};
  for (const row of rows) {
    const listing = listings.get(row.listing_id);
    if (!listing || row.dwell_ms < DWELL_FLOOR_MS) continue;
    const pull = engagement(row) - NEUTRAL_ENGAGEMENT;
    for (const key of Object.keys(featureVector(listing))) {
      interest[key] = (interest[key] ?? 0) + pull;
    }
  }
  return interest;
}

/** Cosine similarity, −1…1. Zero when either side has no weight to speak of. */
export function similarity(features: FeatureVector, interest: InterestVector): number {
  let dot = 0;
  let featureNorm = 0;
  let interestNorm = 0;
  for (const value of Object.values(features)) featureNorm += value * value;
  for (const value of Object.values(interest)) interestNorm += value * value;
  if (featureNorm === 0 || interestNorm === 0) return 0;
  for (const [key, value] of Object.entries(features)) dot += value * (interest[key] ?? 0);
  return dot / (Math.sqrt(featureNorm) * Math.sqrt(interestNorm));
}

/** Ramps personalisation in as evidence accumulates, so it never lurches. */
export function confidence(events: number): number {
  if (events < MIN_EVENTS) return 0;
  return Math.min(1, events / FULL_CONFIDENCE_EVENTS);
}

/**
 * The ordering nudge for one room, clamped to ±`MAX_BONUS`. Zero — deck order
 * exactly as today — until the seeker has looked at `MIN_EVENTS` rooms.
 */
export function affinityBonus(listing: Listing, interest: InterestVector, events: number): number {
  const c = confidence(events);
  if (c === 0) return 0;
  const raw = similarity(featureVector(listing), interest) * MAX_BONUS * c;
  return Math.max(-MAX_BONUS, Math.min(MAX_BONUS, raw));
}

/**
 * Re-order a deck by compatibility plus the attention bonus. Same entries, same
 * count, only the order changes — callers rely on that. With no evidence yet
 * this is exactly the compatibility ordering `buildDeck` already produced.
 */
export function rankByAffinity(
  entries: DeckEntry[],
  interest: InterestVector,
  events: number
): DeckEntry[] {
  const scored = entries.map((entry) => ({
    entry,
    score: sortKey(entry.lifestyle, entry.social) + affinityBonus(entry.listing, interest, events),
  }));
  return scored.sort((a, b) => b.score - a.score).map((s) => s.entry);
}

/**
 * The seeker's taste updated with one fresh reading, without re-reading the
 * database — how the deck adapts while they are still swiping.
 */
export function withReading(interest: InterestVector, listing: Listing, row: DwellRow): InterestVector {
  if (row.dwell_ms < DWELL_FLOOR_MS) return interest;
  const next = { ...interest };
  const pull = engagement(row) - NEUTRAL_ENGAGEMENT;
  for (const key of Object.keys(featureVector(listing))) {
    next[key] = (next[key] ?? 0) + pull;
  }
  return next;
}

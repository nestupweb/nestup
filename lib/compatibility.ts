import type { GuestsFreq, Listing, Profile } from "@/lib/types";

export type Perspective = "seeker" | "lister";

const DAY_MS = 24 * 60 * 60 * 1000;
const GUEST_ORDER: Record<GuestsFreq, number> = { rare: 0, sometimes: 1, often: 2 };

// Convention: when a seeker hasn't set a preference, award ~60% of the
// component's weight rather than 0 — absence of a preference is not the
// same as a mismatch, so it should neither help nor tank the score.
function budgetPoints(seeker: Profile, listing: Listing): number {
  if (seeker.budget_max === 0) return 15; // no budget set: neutral, = 60% of the 25pt weight
  if (listing.rent <= seeker.budget_max) return 25;
  if (listing.rent <= seeker.budget_max * 1.1) return 12; // up to 10% over budget: partial credit
  return 0;
}

// Neutral (no preferred cities) = 12, i.e. 60% of the 20pt weight — same
// 60%-neutral convention as budgetPoints/moveInPoints.
function cityPoints(seeker: Profile, listing: Listing): number {
  if (seeker.preferred_cities.length === 0) return 12; // no preference: neutral
  return seeker.preferred_cities.includes(listing.city) ? 20 : 0;
}

function moveInPoints(seeker: Profile, listing: Listing): number {
  if (!seeker.earliest_move_in) return 9; // no date set: neutral, = 60% of the 15pt weight
  const diffDays =
    Math.abs(Date.parse(listing.available_from) - Date.parse(seeker.earliest_move_in)) / DAY_MS;
  // within two weeks ≈ ideal; within a month and a half ≈ workable
  if (diffDays <= 14) return 15;
  if (diffDays <= 45) return 8;
  return 0;
}

function smokingPoints(seeker: Profile, listing: Listing, lister: Profile, p: Perspective): number {
  if (seeker.smoker && !listing.smoking_allowed) return 0;
  const holder = p === "seeker" ? seeker : lister;
  const other = p === "seeker" ? lister : seeker;
  if (other.smoker && !holder.ok_with_smoker) return 0;
  return 10;
}

function petPoints(seeker: Profile, listing: Listing, lister: Profile, p: Perspective): number {
  if (seeker.has_pet && !listing.pets_allowed) return 0;
  const holder = p === "seeker" ? seeker : lister;
  const other = p === "seeker" ? lister : seeker;
  if (other.has_pet && !holder.ok_with_pets) return 0;
  return 10;
}

function cleanlinessPoints(seeker: Profile, lister: Profile): number {
  return Math.max(0, 10 - 2.5 * Math.abs(seeker.cleanliness - lister.cleanliness));
}

function sleepPoints(seeker: Profile, lister: Profile): number {
  if (seeker.sleep_schedule === lister.sleep_schedule) return 5;
  if (seeker.sleep_schedule === "flexible" || lister.sleep_schedule === "flexible") return 3;
  return 0;
}

function guestPoints(seeker: Profile, lister: Profile): number {
  const diff = Math.abs(GUEST_ORDER[seeker.guests_freq] - GUEST_ORDER[lister.guests_freq]);
  if (diff === 0) return 5;
  if (diff === 1) return 2.5;
  return 0;
}

/**
 * Lifestyle compatibility 0–100. Directional: pass the perspective of the
 * person LOOKING (seeker viewing a listing, or lister viewing a seeker).
 * Scores NEVER filter — they only inform and sort (spec rule 6).
 */
export function lifestyleScore(
  seeker: Profile,
  listing: Listing,
  lister: Profile,
  perspective: Perspective
): number {
  return Math.round(
    budgetPoints(seeker, listing) +
      cityPoints(seeker, listing) +
      moveInPoints(seeker, listing) +
      smokingPoints(seeker, listing, lister, perspective) +
      petPoints(seeker, listing, lister, perspective) +
      cleanlinessPoints(seeker, lister) +
      sleepPoints(seeker, lister) +
      guestPoints(seeker, lister)
  );
}

/** Social compatibility 0–100 from shared interests; null when either side has none. */
export function socialScore(a: Profile, b: Profile): number | null {
  if (a.interests.length === 0 || b.interests.length === 0) return null;
  const setA = new Set(a.interests);
  const setB = new Set(b.interests);
  const shared = [...setA].filter((i) => setB.has(i)).length;
  return Math.round((100 * shared) / Math.min(setA.size, setB.size));
}

export function scoreLabel(score: number): "Great fit" | "Good" | "Fair" | "Low" {
  if (score >= 80) return "Great fit";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Low";
}

/** Deck/queue ordering key. Sorting only — never used to exclude anyone. */
export function sortKey(lifestyle: number, social: number | null): number {
  return social === null ? lifestyle : (lifestyle + social) / 2;
}

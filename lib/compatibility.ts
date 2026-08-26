import type { GuestsFreq, Listing, NoiseLevel, Profile } from "@/lib/types";

export type Perspective = "seeker" | "lister";

const DAY_MS = 24 * 60 * 60 * 1000;
const GUEST_ORDER: Record<GuestsFreq, number> = { rare: 0, sometimes: 1, often: 2 };
const NOISE_ORDER: Record<NoiseLevel, number> = { quiet: 0, moderate: 1, lively: 2 };
// "The most I'm fine with", on the same scales.
const GUEST_TOLERANCE: Record<Profile["pref_guests"], number> = { rare: 0, sometimes: 1, any: 2 };
const NOISE_TOLERANCE: Record<Profile["pref_noise"], number> = { quiet: 0, moderate: 1, any: 2 };

/**
 * Weights (sum 100). Room facts first, then the Daily life table — each row
 * is judged from the viewer's side: their "what I want in roommates" against
 * the other person's "how I live".
 */
const W = {
  budget: 20, city: 18, moveIn: 10,
  smoking: 10, pets: 8, cleanliness: 10, sleep: 6, guests: 6, noise: 4, diet: 4, shabbat: 4,
} as const;

// Convention: when a seeker hasn't set a preference, award ~60% of the
// component's weight rather than 0 — absence of a preference is not the
// same as a mismatch, so it should neither help nor tank the score.
const neutral = (weight: number) => Math.round(weight * 0.6);

function budgetPoints(seeker: Profile, listing: Listing): number {
  if (seeker.budget_max === 0) return neutral(W.budget); // no max set
  if (listing.rent <= seeker.budget_max) return W.budget;
  if (listing.rent <= seeker.budget_max * 1.1) return W.budget / 2; // up to 10% over budget: partial credit
  return 0;
}

function cityPoints(seeker: Profile, listing: Listing): number {
  if (seeker.preferred_cities.length === 0) return neutral(W.city);
  return seeker.preferred_cities.includes(listing.city) ? W.city : 0;
}

function moveInPoints(seeker: Profile, listing: Listing): number {
  if (!seeker.earliest_move_in) return neutral(W.moveIn);
  const diffDays =
    Math.abs(Date.parse(listing.available_from) - Date.parse(seeker.earliest_move_in)) / DAY_MS;
  // within two weeks ≈ ideal; within a month and a half ≈ workable
  if (diffDays <= 14) return W.moveIn;
  if (diffDays <= 45) return W.moveIn / 2;
  return 0;
}

function smokingPoints(seeker: Profile, listing: Listing, holder: Profile, other: Profile): number {
  if (seeker.smoker && !listing.smoking_allowed) return 0;
  if (other.smoker && !holder.ok_with_smoker) return 0;
  return W.smoking;
}

function petPoints(seeker: Profile, listing: Listing, holder: Profile, other: Profile): number {
  if (seeker.has_pet && !listing.pets_allowed) return 0;
  if (other.has_pet && !holder.ok_with_pets) return 0;
  return W.pets;
}

/** 6 for living alike, 4 for the other person meeting the tidiness I ask for. */
function cleanlinessPoints(holder: Profile, other: Profile): number {
  const alike = Math.max(0, 6 - 1.5 * Math.abs(holder.cleanliness - other.cleanliness));
  const shortfall = Math.max(0, holder.pref_cleanliness - other.cleanliness);
  return alike + Math.max(0, 4 - 2 * shortfall);
}

function sleepPoints(holder: Profile, other: Profile): number {
  if (holder.pref_sleep !== "any") {
    if (other.sleep_schedule === holder.pref_sleep) return W.sleep;
    return other.sleep_schedule === "flexible" ? W.sleep * (2 / 3) : 0;
  }
  if (holder.sleep_schedule === other.sleep_schedule) return W.sleep;
  if (holder.sleep_schedule === "flexible" || other.sleep_schedule === "flexible") return W.sleep * (2 / 3);
  return W.sleep / 3;
}

function guestPoints(holder: Profile, other: Profile): number {
  if (GUEST_ORDER[other.guests_freq] > GUEST_TOLERANCE[holder.pref_guests]) return 0;
  const diff = Math.abs(GUEST_ORDER[holder.guests_freq] - GUEST_ORDER[other.guests_freq]);
  return [W.guests, W.guests * (2 / 3), W.guests / 3][diff];
}

function noisePoints(holder: Profile, other: Profile): number {
  if (NOISE_ORDER[other.noise_level] > NOISE_TOLERANCE[holder.pref_noise]) return 0;
  const diff = Math.abs(NOISE_ORDER[holder.noise_level] - NOISE_ORDER[other.noise_level]);
  return [W.noise, W.noise * 0.6, W.noise * 0.25][diff];
}

function dietPoints(holder: Profile, other: Profile): number {
  switch (holder.pref_diet) {
    case "any":
      return W.diet;
    case "kosher":
      return other.diet === "kosher" ? W.diet : 0;
    case "vegetarian":
      return other.diet === "vegetarian" || other.diet === "vegan" ? W.diet : 0;
    case "vegan":
      return other.diet === "vegan" ? W.diet : 0;
  }
}

/**
 * Shabbat: what I want in roommates against how the other person keeps it.
 * Someone who preferred not to say is neutral, never a mismatch.
 */
function shabbatPoints(holder: Profile, other: Profile): number {
  if (holder.pref_shabbat === "any") return W.shabbat;
  if (other.shabbat === "") return neutral(W.shabbat);
  switch (holder.pref_shabbat) {
    case "observant":
      return other.shabbat === "observant" ? W.shabbat : 0;
    case "traditional":
      return other.shabbat === "not_observant" ? 0 : W.shabbat;
    case "not_observant":
      return other.shabbat === "not_observant" ? W.shabbat : other.shabbat === "traditional" ? W.shabbat / 2 : 0;
  }
}

/**
 * Lifestyle compatibility 0–100. Directional: pass the perspective of the
 * person LOOKING (seeker viewing a listing, or lister viewing a seeker); the
 * looker's "what I want in roommates" is checked against the other's habits.
 * The swipe deck admits only rooms whose combined score reaches
 * `MIN_DECK_SCORE` (lib/swipe.ts); elsewhere scores inform and sort only.
 */
export function lifestyleScore(
  seeker: Profile,
  listing: Listing,
  lister: Profile,
  perspective: Perspective
): number {
  const holder = perspective === "seeker" ? seeker : lister;
  const other = perspective === "seeker" ? lister : seeker;
  return Math.round(
    budgetPoints(seeker, listing) +
      cityPoints(seeker, listing) +
      moveInPoints(seeker, listing) +
      smokingPoints(seeker, listing, holder, other) +
      petPoints(seeker, listing, holder, other) +
      cleanlinessPoints(holder, other) +
      sleepPoints(holder, other) +
      guestPoints(holder, other) +
      noisePoints(holder, other) +
      dietPoints(holder, other) +
      shabbatPoints(holder, other)
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

/** Deck/queue ordering key; the swipe deck also gates on it (`MIN_DECK_SCORE`). */
export function sortKey(lifestyle: number, social: number | null): number {
  return social === null ? lifestyle : (lifestyle + social) / 2;
}

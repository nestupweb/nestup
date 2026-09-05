import { describe, expect, test } from "vitest";
import { MIN_DECK_SCORE, buildDeck } from "@/lib/swipe";
import { lifestyleScore, scoreLabel, socialScore, sortKey } from "@/lib/compatibility";
import { INTERESTS } from "@/lib/constants";
import type { Listing, Profile } from "@/lib/types";

/**
 * Properties of the scoring function, rather than individual scores.
 *
 * `compatibility.test.ts` pins each weighted row down with a worked example —
 * that a smoker against a no-smoking room loses exactly the smoking weight,
 * that "prefer not to say" is neutral, and so on. Those are the tests that
 * catch a wrong rule.
 *
 * These catch a wrong *scale*. The number is shown to members as a percentage,
 * sorts the deck, and is the gate the deck admits rooms on
 * (`MIN_DECK_SCORE = 60`, read against `scoreLabel`'s "Good" band). All three
 * of those quietly stop meaning anything if the weights drift out of 100, if a
 * component can go negative, or if every pairing collapses into one band —
 * none of which any single worked example would notice. They are asserted here
 * over a deterministic sweep of a few thousand pairings instead.
 */

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "seeker", full_name: "Seeker", age: 25, occupation: "", bio: "",
    avatar_url: null, smoker: false, has_pet: false, cleanliness: 3,
    sleep_schedule: "flexible", guests_freq: "sometimes",
    interests: ["Music", "Cooking", "Travel"],
    ok_with_smoker: true, ok_with_pets: true,
    noise_level: "moderate", diet: "none", pref_cleanliness: 1, pref_sleep: "any",
    pref_guests: "any", pref_noise: "any", pref_diet: "any", shabbat: "", pref_shabbat: "any",
    chores: [], gender: null, pref_same_gender: false,
    budget_min: 0, budget_max: 3000, preferred_cities: ["Tel Aviv"],
    earliest_move_in: "2026-10-01", pref_lease_term: "any", pref_safe_room: "any",
    pref_amenities: [], notify_new_matches: false, created_at: "", updated_at: "",
    ...overrides,
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l1", owner_id: "o1", title: "Sunlit room", description: "",
    city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", rent: 2800,
    available_from: "2026-10-01", lease_term: "flexible", property_type: "apartment",
    rooms: 3, size_sqm: null, roommates_count: 2, household_size: 2,
    pets_allowed: true, smoking_allowed: false, wanted_gender: null, household_gender: null,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    safe_room: "none", food_restrictions: "", street: "Florentin", house_number: "12",
    lat: null, lng: null, coords_source: "none",
    photo_urls: [], photo_labels: [], viewing_slots: [], is_active: true,
    taken_at: null, removed_at: null, created_at: "", updated_at: "",
    ...overrides,
  };
}

/**
 * A seeded generator, so a failure is reproducible: the same sweep runs on
 * every machine and in CI, and a red result can be pasted back into a worked
 * example rather than chased.
 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const CLEANLINESS = [1, 2, 3, 4, 5] as const;
const SLEEP = ["early", "late", "flexible"] as const;
const PREF_SLEEP = ["any", "early", "late"] as const;
const GUESTS = ["rare", "sometimes", "often"] as const;
const PREF_GUESTS = ["any", "rare", "sometimes"] as const;
const NOISE = ["quiet", "moderate", "lively"] as const;
const PREF_NOISE = ["any", "quiet", "moderate"] as const;
const DIET = ["none", "kosher", "vegetarian", "vegan", "halal", "gluten_free", "other"] as const;
const PREF_DIET = ["any", "kosher", "vegetarian", "vegan"] as const;
const SHABBAT = ["", "observant", "traditional", "not_observant"] as const;
const PREF_SHABBAT = ["any", "observant", "traditional", "not_observant"] as const;
const CITIES = ["Tel Aviv", "Haifa", "Jerusalem"] as const;
const DATES = ["2026-09-15", "2026-10-01", "2026-11-20", "2027-03-01"] as const;

/** One randomised pairing: a seeker, a room, and the person already living in it. */
function pairing(rand: () => number) {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const traits = () => ({
    smoker: rand() < 0.3,
    has_pet: rand() < 0.3,
    cleanliness: pick(CLEANLINESS),
    sleep_schedule: pick(SLEEP),
    guests_freq: pick(GUESTS),
    noise_level: pick(NOISE),
    diet: pick(DIET),
    shabbat: pick(SHABBAT),
    ok_with_smoker: rand() < 0.5,
    ok_with_pets: rand() < 0.5,
    pref_cleanliness: pick(CLEANLINESS),
    pref_sleep: pick(PREF_SLEEP),
    pref_guests: pick(PREF_GUESTS),
    pref_noise: pick(PREF_NOISE),
    pref_diet: pick(PREF_DIET),
    pref_shabbat: pick(PREF_SHABBAT),
    interests: INTERESTS.filter(() => rand() < 0.25),
  });
  return {
    seeker: profile({
      ...traits(),
      budget_min: rand() < 0.5 ? 0 : 1500,
      budget_max: rand() < 0.2 ? 0 : 2000 + Math.floor(rand() * 4000),
      preferred_cities: rand() < 0.15 ? [] : [pick(CITIES)],
      earliest_move_in: rand() < 0.15 ? null : pick(DATES),
    }),
    lister: profile({ user_id: "o1", ...traits() }),
    room: listing({
      city: pick(CITIES),
      rent: 1500 + Math.floor(rand() * 5000),
      available_from: pick(DATES),
      smoking_allowed: rand() < 0.4,
      pets_allowed: rand() < 0.5,
    }),
  };
}

/** 3,000 pairings from a fixed seed. */
function sweep(): number[] {
  const rand = lcg(20260905);
  const scores: number[] = [];
  for (let i = 0; i < 3000; i++) {
    const { seeker, room, lister } = pairing(rand);
    scores.push(lifestyleScore(seeker, room, lister, "seeker"));
    scores.push(lifestyleScore(seeker, room, lister, "lister"));
  }
  return scores;
}

describe("the 0–100 scale is real", () => {
  test("every score is a whole number inside 0…100, over three thousand pairings", () => {
    const scores = sweep();
    const outside = scores.filter((s) => !Number.isInteger(s) || s < 0 || s > 100);
    expect(outside).toEqual([]);
    expect(scores).toHaveLength(6000);
  });

  /**
   * The weights are declared as summing to 100. Nothing enforces that, and a
   * row added with its own weight — or one re-weighted without adjusting the
   * others — would silently make a perfect match score 104 or 92. A perfect
   * practical fit reaching *exactly* 100 is what says the sum still holds.
   */
  test("a perfect fit is exactly 100 — the weights still add up", () => {
    const seeker = profile({
      cleanliness: 5, pref_cleanliness: 1, sleep_schedule: "flexible", pref_sleep: "any",
      guests_freq: "rare", pref_guests: "any", noise_level: "quiet", pref_noise: "any",
      diet: "none", pref_diet: "any", shabbat: "", pref_shabbat: "any",
      smoker: false, has_pet: false, ok_with_smoker: true, ok_with_pets: true,
      budget_max: 5000, preferred_cities: ["Tel Aviv"], earliest_move_in: "2026-10-01",
    });
    const lister = profile({ ...seeker, user_id: "o1" });
    expect(lifestyleScore(seeker, listing({ rent: 2800 }), lister, "seeker")).toBe(100);
  });

  /**
   * The scale has to be *used*, not merely bounded. If a weighting change
   * squeezed every pairing into the sixties, `MIN_DECK_SCORE` would admit
   * everything or nothing and the pill on the card would stop meaning
   * anything, while every worked example in `compatibility.test.ts` still
   * passed.
   */
  test("the sweep spreads across the bands rather than collapsing into one", () => {
    const scores = sweep();
    const labels = new Set(scores.map(scoreLabel));

    expect(Math.min(...scores)).toBeLessThan(50);
    expect(Math.max(...scores)).toBeGreaterThan(90);
    expect(labels).toEqual(new Set(["Great fit", "Good", "Fair", "Low"]));
  });

  test("the social score is either null or a whole number inside 0…100", () => {
    const rand = lcg(4242);
    for (let i = 0; i < 1000; i++) {
      const a = profile({ interests: INTERESTS.filter(() => rand() < 0.3) });
      const b = profile({ user_id: "o1", interests: INTERESTS.filter(() => rand() < 0.3) });
      const score = socialScore(a, b);
      if (score === null) continue;
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test("the deck's sort key stays on the same scale as the scores it mixes", () => {
    const rand = lcg(99);
    for (let i = 0; i < 1000; i++) {
      const lifestyle = Math.floor(rand() * 101);
      const social = rand() < 0.3 ? null : Math.floor(rand() * 101);
      const key = sortKey(lifestyle, social);
      expect(key).toBeGreaterThanOrEqual(0);
      expect(key).toBeLessThanOrEqual(100);
    }
  });
});

describe("the score moves in the direction a member would expect", () => {
  /**
   * Rent only ever costs points. A change that made an expensive room score
   * higher than a cheap one for the same seeker would be invisible in a single
   * worked example and obvious to anyone using the app.
   */
  test("raising the rent never raises the score", () => {
    const seeker = profile({ budget_max: 3000 });
    const lister = profile({ user_id: "o1" });
    let previous = Infinity;
    for (let rent = 1000; rent <= 6000; rent += 100) {
      const score = lifestyleScore(seeker, listing({ rent }), lister, "seeker");
      expect(score).toBeLessThanOrEqual(previous);
      previous = score;
    }
  });

  test("a room in a city the seeker asked for never scores below the same room elsewhere", () => {
    const seeker = profile({ preferred_cities: ["Tel Aviv"] });
    const lister = profile({ user_id: "o1" });
    const wanted = lifestyleScore(seeker, listing({ city: "Tel Aviv" }), lister, "seeker");
    const elsewhere = lifestyleScore(seeker, listing({ city: "Haifa" }), lister, "seeker");
    expect(wanted).toBeGreaterThan(elsewhere);
  });

  /**
   * Saying nothing is not the same as saying no. A seeker who left the budget
   * blank must not be scored as if every room were over it — that convention
   * (`neutral`, ~60% of the weight) is what lets a half-finished profile still
   * get a usable deck.
   */
  test("an unstated preference sits between a match and a mismatch, never at the bottom", () => {
    const lister = profile({ user_id: "o1" });
    const room = listing({ rent: 2800, city: "Tel Aviv" });

    const matched = lifestyleScore(profile({ budget_max: 3000 }), room, lister, "seeker");
    const unstated = lifestyleScore(profile({ budget_max: 0 }), room, lister, "seeker");
    const mismatched = lifestyleScore(profile({ budget_max: 1000 }), room, lister, "seeker");

    expect(unstated).toBeLessThan(matched);
    expect(unstated).toBeGreaterThan(mismatched);
  });
});

/**
 * The gate and the label are two spellings of the same threshold. If either
 * moved without the other, the deck would start showing rooms the card itself
 * calls a poor match — or hiding ones it calls good.
 */
describe("the deck gate agrees with the label members are shown", () => {
  test("MIN_DECK_SCORE is exactly where 'Good' begins", () => {
    expect(scoreLabel(MIN_DECK_SCORE)).toBe("Good");
    expect(scoreLabel(MIN_DECK_SCORE - 1)).toBe("Fair");
  });

  test("nothing below the 'Good' band ever reaches a real deck", () => {
    const rand = lcg(777);
    for (let i = 0; i < 300; i++) {
      const { seeker, room, lister } = pairing(rand);
      const deck = buildDeck(seeker, [room], [lister], []);
      for (const entry of deck) {
        const combined = sortKey(entry.lifestyle, entry.social);
        expect(combined).toBeGreaterThanOrEqual(MIN_DECK_SCORE);
        expect(["Great fit", "Good"]).toContain(scoreLabel(Math.round(combined)));
      }
    }
  });
});

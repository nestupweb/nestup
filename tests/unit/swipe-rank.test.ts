import { describe, expect, test } from "vitest";
import { MIN_DECK_SCORE, buildDeck, fitsHardFilters, formatMoveIn, getSwipeDeck, introMessage, passesGenderRules, sharedInterests } from "@/lib/swipe";
import { sortKey } from "@/lib/compatibility";
import type { Listing, Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "seeker", full_name: "Seeker", age: 25, occupation: "", bio: "",
    avatar_url: null, smoker: false, has_pet: false, cleanliness: 3,
    sleep_schedule: "flexible", guests_freq: "sometimes",
    interests: ["Music", "Cooking", "Travel"],
    ok_with_smoker: true, ok_with_pets: true,
    noise_level: "moderate", diet: "none", pref_cleanliness: 1, pref_sleep: "any", pref_guests: "any", pref_noise: "any", pref_diet: "any", shabbat: "", pref_shabbat: "any", chores: [], gender: null, pref_same_gender: false,
    budget_min: 0, budget_max: 3000, preferred_cities: ["Tel Aviv"],
    earliest_move_in: "2026-10-01", pref_lease_term: "any", pref_safe_room: "any", pref_amenities: [], notify_new_matches: false, created_at: "", updated_at: "",
    ...overrides,
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l1", owner_id: "o1", title: "Sunlit room", description: "",
    city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", rent: 2800,
    available_from: "2026-10-01", lease_term: "flexible", property_type: "apartment", rooms: 3, size_sqm: null,
    roommates_count: 2, pets_allowed: true, smoking_allowed: false, wanted_gender: null, household_gender: null,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    safe_room: "none", food_restrictions: "", street: "Florentin", house_number: "12", lat: null, lng: null, coords_source: "none",
    photo_urls: [], photo_labels: [], viewing_slots: [], is_active: true, taken_at: null, removed_at: null, created_at: "", updated_at: "",
    ...overrides,
  };
}

describe("buildDeck", () => {
  const seeker = profile();
  const goodOwner = profile({ user_id: "o1", interests: ["Music", "Cooking", "Travel"] });
  const farOwner = profile({ user_id: "o2", smoker: true, interests: ["Gaming"] });
  // Shares two of three interests → social 67; lifestyle stays high → combined ≥ 60.
  const okOwner = profile({ user_id: "o3", interests: ["Music", "Cooking", "Gaming"] });

  test("ranks the better-matching room first", () => {
    const deck = buildDeck(
      seeker,
      [listing({ id: "ok", owner_id: "o3" }), listing({ id: "near", owner_id: "o1" })],
      [goodOwner, okOwner],
      []
    );
    expect(deck.map((e) => e.listing.id)).toEqual(["near", "ok"]);
    expect(deck[0].social).toBe(100);
    expect(deck[1].social).toBe(67);
    for (const e of deck) expect(sortKey(e.lifestyle, e.social)).toBeGreaterThanOrEqual(MIN_DECK_SCORE);
  });

  test("drops rooms whose combined score falls below MIN_DECK_SCORE", () => {
    const deck = buildDeck(
      seeker,
      [listing({ id: "far", owner_id: "o2", city: "Haifa", rent: 5000 }), listing({ id: "near", owner_id: "o1" })],
      [goodOwner, farOwner],
      []
    );
    expect(deck.map((e) => e.listing.id)).toEqual(["near"]);
  });

  test("keeps a room sitting exactly on the threshold", () => {
    // Lifestyle 100 (identical profile, ideal listing) with no interests on
    // the owner's side → social null → combined = lifestyle. Push lifestyle
    // to exactly 60 without leaving the seeker's cities / budget (those are
    // hard filters now): no preferred cities → neutral city (−7), move-in 45
    // days apart (−5), a pet against "no pets" (−8), a smoker against
    // "non-smokers only" (−10), lively against "quiet, please" (−4), no diet
    // against "vegetarian or vegan" (−4), and asking for tidiness 4 of a 3 (−2).
    const edgeOwner = profile({
      user_id: "o4", interests: [], has_pet: true, smoker: true, noise_level: "lively",
    });
    const edgeSeeker = profile({
      preferred_cities: [], ok_with_pets: false, ok_with_smoker: false, pref_noise: "quiet", pref_diet: "vegetarian", pref_cleanliness: 4,
    });
    const deck = buildDeck(edgeSeeker, [listing({ id: "edge", owner_id: "o4", available_from: "2026-11-15" })], [edgeOwner], []);
    expect(deck.map((e) => e.listing.id)).toEqual(["edge"]);
    expect(deck[0].lifestyle).toBe(MIN_DECK_SCORE);
    expect(deck[0].social).toBeNull();
  });

  // --- Hard filters: never a room outside my cities or my budget, however well the people match ---

  test("a perfect match in another city never makes the deck", () => {
    const deck = buildDeck(seeker, [listing({ id: "haifa", city: "Haifa" }), listing({ id: "tlv" })], [goodOwner], []);
    expect(deck.map((e) => e.listing.id)).toEqual(["tlv"]);
    expect(fitsHardFilters(seeker, listing({ city: "Haifa" }))).toBe(false);
    expect(fitsHardFilters(seeker, listing({ city: "Tel Aviv" }))).toBe(true);
  });

  test("rent above the max budget is out — even one shekel, no 10% grace on the deck", () => {
    const deck = buildDeck(seeker, [listing({ id: "over", rent: 3001 }), listing({ id: "at", rent: 3000 })], [goodOwner], []);
    expect(deck.map((e) => e.listing.id)).toEqual(["at"]);
  });

  test("rent below the min budget is out too; unset preferences don't filter", () => {
    const picky = profile({ budget_min: 2500 });
    expect(fitsHardFilters(picky, listing({ rent: 2000 }))).toBe(false);
    expect(fitsHardFilters(picky, listing({ rent: 2500 }))).toBe(true);
    const open = profile({ preferred_cities: [], budget_min: 0, budget_max: 0 });
    expect(fitsHardFilters(open, listing({ city: "Eilat", rent: 99999 }))).toBe(true);
    const deck = buildDeck(open, [listing({ id: "far", city: "Haifa", rent: 9000 })], [goodOwner], []);
    expect(deck.map((e) => e.listing.id)).toEqual(["far"]); // still scored, and the people match
  });

  test("attaches extra roommates and never repeats the host", () => {
    const roommate = profile({ user_id: "r1", full_name: "Noa" });
    const deck = buildDeck(
      seeker,
      [listing()],
      [goodOwner],
      [
        { listing_id: "l1", profile: roommate },
        { listing_id: "l1", profile: goodOwner },
        { listing_id: "l1", profile: null },
      ]
    );
    expect(deck[0].owner.user_id).toBe("o1");
    expect(deck[0].residents.map((p) => p.user_id)).toEqual(["r1"]);
  });

  test("skips a listing whose owner profile is missing (no score possible)", () => {
    const deck = buildDeck(seeker, [listing({ owner_id: "ghost" })], [goodOwner], []);
    expect(deck).toEqual([]);
  });
});

test("formatMoveIn renders the calendar date regardless of timezone", () => {
  expect(formatMoveIn("2026-10-01")).toBe("1 Oct 2026");
  expect(formatMoveIn("not-a-date")).toBe("not-a-date");
});

test("introMessage is a short hello without the host's name, or the seeker's own template", () => {
  const owner = profile({ user_id: "o1", full_name: "Dana Levi" });
  const entry = { listing: listing(), owner, residents: [], lifestyle: 80, social: 50 };
  expect(introMessage(entry)).toBe("Hi, I liked the room — can we schedule a viewing?");
  expect(introMessage(entry, "  ")).toBe("Hi, I liked the room — can we schedule a viewing?");
  expect(introMessage(entry)).not.toMatch(/Dana/);
  expect(introMessage(entry, "Hey {name}! Free this week? {NAME} again")).toBe("Hey Dana! Free this week? Dana again");
  expect(introMessage(entry, "Shalom, is the room still free?")).toBe("Shalom, is the room still free?");
});

test("sharedInterests keeps the seeker's order", () => {
  const a = profile({ interests: ["Yoga", "Music", "Art"] });
  const b = profile({ interests: ["Art", "Yoga", "Tech"] });
  expect(sharedInterests(a, b)).toEqual(["Yoga", "Art"]);
});

describe("getSwipeDeck query", () => {
  /** Records what the deck asks the database for. */
  function fakeSupabase(seeker: Profile) {
    const calls: [string, ...unknown[]][] = [];
    const builder: Record<string, (...a: unknown[]) => unknown> = {};
    for (const m of ["select", "eq", "is", "neq", "in", "lte", "gte", "order"]) {
      builder[m] = (...args: unknown[]) => {
        calls.push([m, ...args]);
        return builder;
      };
    }
    builder.limit = (...args: unknown[]) => {
      calls.push(["limit", ...args]);
      return Promise.resolve({ data: [] });
    };
    const supabase = {
      from: (table: string) => {
        calls.push(["from", table]);
        if (table === "swipes") {
          const swipes: Record<string, (...a: unknown[]) => unknown> = {};
          swipes.select = () => swipes;
          swipes.eq = () => Promise.resolve({ data: [] });
          return swipes;
        }
        return builder;
      },
    };
    return { supabase: supabase as never, calls, seeker };
  }

  test("asks the database for the seeker's cities and budget, not the newest 300 of everything", async () => {
    const { supabase, calls } = fakeSupabase(profile());
    await getSwipeDeck(supabase, profile({ preferred_cities: ["Tel Aviv", "Givatayim"], budget_min: 2000, budget_max: 3000 }));
    expect(calls).toContainEqual(["in", "city", ["Tel Aviv", "Givatayim"]]);
    expect(calls).toContainEqual(["lte", "rent", 3000]);
    expect(calls).toContainEqual(["gte", "rent", 2000]);
    // and a closed or deleted room never reaches the deck
    expect(calls).toContainEqual(["eq", "is_active", true]);
    expect(calls).toContainEqual(["is", "removed_at", null]);
  });

  test("a seeker with no preferences set filters on nothing", async () => {
    const { supabase, calls } = fakeSupabase(profile());
    await getSwipeDeck(supabase, profile({ preferred_cities: [], budget_min: 0, budget_max: 0 }));
    expect(calls.some(([m]) => m === "in")).toBe(false);
    expect(calls.some(([m]) => m === "lte" || m === "gte")).toBe(false);
  });
});

/**
 * Both gender rules are hard filters, not score adjustments (0037): a room
 * that fails either one is not in the deck at all.
 */
describe("gender rules in the deck", () => {
  test("'same gender as me' admits only households where everyone matches", () => {
    const her = profile({ gender: "female", pref_same_gender: true });
    expect(passesGenderRules(her, listing({ household_gender: "female" }))).toBe(true);
    expect(passesGenderRules(her, listing({ household_gender: "male" }))).toBe(false);
    // null is a mixed household, or one where somebody hasn't said. Both are
    // "we cannot promise they all match", so both are out.
    expect(passesGenderRules(her, listing({ household_gender: null }))).toBe(false);
  });

  test("without the box ticked, the household's gender is irrelevant", () => {
    const her = profile({ gender: "female", pref_same_gender: false });
    expect(passesGenderRules(her, listing({ household_gender: "male" }))).toBe(true);
    expect(passesGenderRules(her, listing({ household_gender: null }))).toBe(true);
  });

  test("ticking it without stating a gender asks something unanswerable, so it is skipped", () => {
    // Better than emptying their deck with no explanation; the profile form is
    // where this gets fixed.
    const nobody = profile({ gender: null, pref_same_gender: true });
    expect(passesGenderRules(nobody, listing({ household_gender: "male" }))).toBe(true);
  });

  test("a room that asks for one gender reaches nobody else — including the unstated", () => {
    const room = listing({ wanted_gender: "female" });
    expect(passesGenderRules(profile({ gender: "female" }), room)).toBe(true);
    expect(passesGenderRules(profile({ gender: "male" }), room)).toBe(false);
    expect(passesGenderRules(profile({ gender: null }), room)).toBe(false);
  });

  test("the two rules both have to pass", () => {
    const strict = profile({ gender: "male", pref_same_gender: true });
    // Household matches him, but the room wants women.
    expect(passesGenderRules(strict, listing({ household_gender: "male", wanted_gender: "female" }))).toBe(false);
    expect(passesGenderRules(strict, listing({ household_gender: "male", wanted_gender: "male" }))).toBe(true);
  });
});

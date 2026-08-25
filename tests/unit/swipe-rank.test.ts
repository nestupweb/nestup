import { describe, expect, test } from "vitest";
import { MIN_DECK_SCORE, buildDeck, formatMoveIn, introMessage, sharedInterests } from "@/lib/swipe";
import { sortKey } from "@/lib/compatibility";
import type { Listing, Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "seeker", full_name: "Seeker", age: 25, occupation: "", bio: "",
    avatar_url: null, smoker: false, has_pet: false, cleanliness: 3,
    sleep_schedule: "flexible", guests_freq: "sometimes",
    interests: ["Music", "Cooking", "Travel"],
    ok_with_smoker: true, ok_with_pets: true,
    budget_min: 0, budget_max: 3000, preferred_cities: ["Tel Aviv"],
    earliest_move_in: "2026-10-01", created_at: "", updated_at: "",
    ...overrides,
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l1", owner_id: "o1", title: "Sunlit room", description: "",
    city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", rent: 2800,
    available_from: "2026-10-01", property_type: "apartment", rooms: 3, size_sqm: null,
    roommates_count: 2, pets_allowed: true, smoking_allowed: false,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    photo_urls: [], is_active: true, created_at: "", updated_at: "",
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
    // to exactly 60 via city (−20), pets (−10), sleep early/late (−5),
    // guests sometimes/often two steps apart (−5).
    const edgeOwner = profile({
      user_id: "o4", interests: [], has_pet: true, sleep_schedule: "early", guests_freq: "often",
    });
    const edgeSeeker = profile({ ok_with_pets: false, sleep_schedule: "late", guests_freq: "rare" });
    const deck = buildDeck(edgeSeeker, [listing({ id: "edge", owner_id: "o4", city: "Haifa" })], [edgeOwner], []);
    expect(deck.map((e) => e.listing.id)).toEqual(["edge"]);
    expect(deck[0].lifestyle).toBe(MIN_DECK_SCORE);
    expect(deck[0].social).toBeNull();
  });

  test("attaches extra flatmates and never repeats the host", () => {
    const flatmate = profile({ user_id: "r1", full_name: "Noa" });
    const deck = buildDeck(
      seeker,
      [listing()],
      [goodOwner],
      [
        { listing_id: "l1", profile: flatmate },
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

test("introMessage greets the household by first name and names the room", () => {
  const owner = profile({ user_id: "o1", full_name: "Dana Levi" });
  const entry = { listing: listing(), owner, residents: [], lifestyle: 80, social: 50 };
  expect(introMessage(entry)).toMatch(/^Hi Dana! I just liked your room at Florentin 12, Tel Aviv on NestUp\./);
  const withRoommates = { ...entry, residents: [profile({ user_id: "r1", full_name: "Noa" })] };
  expect(introMessage(withRoommates)).toMatch(/^Hi Dana and everyone!/);
});

test("sharedInterests keeps the seeker's order", () => {
  const a = profile({ interests: ["Yoga", "Music", "Art"] });
  const b = profile({ interests: ["Art", "Yoga", "Tech"] });
  expect(sharedInterests(a, b)).toEqual(["Yoga", "Art"]);
});

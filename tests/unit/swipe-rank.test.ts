import { describe, expect, test } from "vitest";
import { buildDeck, formatMoveIn, sharedInterests } from "@/lib/swipe";
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

  test("ranks the better-matching room first without dropping the weaker one", () => {
    const deck = buildDeck(
      seeker,
      [listing({ id: "far", owner_id: "o2", city: "Haifa", rent: 5000 }), listing({ id: "near", owner_id: "o1" })],
      [goodOwner, farOwner],
      []
    );
    expect(deck.map((e) => e.listing.id)).toEqual(["near", "far"]);
    expect(deck[0].lifestyle).toBeGreaterThan(deck[1].lifestyle);
    expect(deck[0].social).toBe(100);
    expect(deck[1].social).toBe(0);
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

test("sharedInterests keeps the seeker's order", () => {
  const a = profile({ interests: ["Yoga", "Music", "Art"] });
  const b = profile({ interests: ["Art", "Yoga", "Tech"] });
  expect(sharedInterests(a, b)).toEqual(["Yoga", "Art"]);
});

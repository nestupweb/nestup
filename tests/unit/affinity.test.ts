import { describe, expect, test } from "vitest";
import {
  DWELL_CAP_MS,
  MAX_BONUS,
  MIN_EVENTS,
  affinityBonus,
  buildInterest,
  engagement,
  featureVector,
  rankByAffinity,
  similarity,
  withReading,
  type DwellRow,
} from "@/lib/affinity";
import type { DeckEntry } from "@/lib/swipe";
import type { Listing, Profile } from "@/lib/types";

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l1", owner_id: "o1", title: "Sunlit room", description: "",
    city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", rent: 3000,
    available_from: "2026-10-01", lease_term: "flexible", property_type: "apartment", rooms: 3, size_sqm: null,
    roommates_count: 2, pets_allowed: false, smoking_allowed: false, wanted_gender: null, household_gender: null,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    safe_room: "none", food_restrictions: "", street: "Florentin", house_number: "12",
    lat: null, lng: null, coords_source: "none",
    photo_urls: [], photo_labels: [], viewing_slots: [], is_active: true,
    taken_at: null, removed_at: null, created_at: "", updated_at: "",
    ...overrides,
  };
}

const owner = { user_id: "o1", full_name: "Owner" } as unknown as Profile;

function entry(l: Listing, lifestyle: number, social: number | null = null): DeckEntry {
  return { listing: l, owner, residents: [], lifestyle, social };
}

function row(overrides: Partial<DwellRow> = {}): DwellRow {
  return { listing_id: "l1", dwell_ms: 20_000, photos_seen: 4, pages_seen: 3, ...overrides };
}

describe("engagement", () => {
  test("rises with time, photos and pages, and never exceeds 1", () => {
    expect(engagement(row({ dwell_ms: 0, photos_seen: 0, pages_seen: 0 }))).toBe(0);
    expect(engagement(row())).toBeCloseTo(1, 5);
    // Far beyond the cap still cannot score above a fully-engaged reading.
    expect(engagement(row({ dwell_ms: 10 * DWELL_CAP_MS, photos_seen: 99, pages_seen: 99 }))).toBeCloseTo(1, 5);
  });

  test("deliberate navigation counts even when the clock is short", () => {
    const glanced = engagement(row({ dwell_ms: 3_000, photos_seen: 0, pages_seen: 0 }));
    const explored = engagement(row({ dwell_ms: 3_000, photos_seen: 4, pages_seen: 3 }));
    expect(explored).toBeGreaterThan(glanced);
  });
});

describe("featureVector", () => {
  test("buckets rent so nearby prices look alike", () => {
    expect(featureVector(listing({ rent: 3100 }))["rent:3000"]).toBe(1);
    expect(featureVector(listing({ rent: 2900 }))["rent:3000"]).toBe(1);
  });

  test("records only the amenities a room actually has", () => {
    const v = featureVector(listing({ balcony: true, parking: false }));
    expect(v["has:balcony"]).toBe(1);
    expect(v["has:parking"]).toBeUndefined();
  });

  test("uses photo labels as the cheap stand-in for photo similarity", () => {
    const v = featureVector(listing({ photo_labels: ["balcony", "kitchen", "balcony"] }));
    expect(v["photo:balcony"]).toBe(1);
    expect(v["photo:kitchen"]).toBe(1);
  });
});

describe("buildInterest", () => {
  const florentin = listing({ id: "a", neighborhood: "Florentin", balcony: true });
  const ramatAviv = listing({ id: "b", neighborhood: "Ramat Aviv", balcony: false, rent: 6000 });
  const catalogue = new Map([[florentin.id, florentin], [ramatAviv.id, ramatAviv]]);

  test("pulls toward features of rooms that held attention and away from the rest", () => {
    const interest = buildInterest(
      [
        row({ listing_id: "a", dwell_ms: 25_000, photos_seen: 5, pages_seen: 3 }),
        row({ listing_id: "b", dwell_ms: 2_000, photos_seen: 0, pages_seen: 0 }),
      ],
      catalogue
    );
    expect(interest["area:Florentin"]).toBeGreaterThan(0);
    expect(interest["area:Ramat Aviv"]).toBeLessThan(0);
  });

  test("ignores readings below the noise floor and rooms that are gone", () => {
    expect(buildInterest([row({ listing_id: "a", dwell_ms: 200 })], catalogue)).toEqual({});
    expect(buildInterest([row({ listing_id: "vanished" })], catalogue)).toEqual({});
  });
});

describe("similarity", () => {
  test("is zero when there is nothing learned yet", () => {
    expect(similarity(featureVector(listing()), {})).toBe(0);
  });
});

describe("affinityBonus — the safety guarantees", () => {
  const interest = buildInterest(
    [row({ listing_id: "a", dwell_ms: 30_000 })],
    new Map([["a", listing({ id: "a", balcony: true })]])
  );

  test("is exactly zero until the seeker has looked at MIN_EVENTS rooms", () => {
    for (let events = 0; events < MIN_EVENTS; events += 1) {
      expect(affinityBonus(listing({ balcony: true }), interest, events)).toBe(0);
    }
    expect(affinityBonus(listing({ balcony: true }), interest, MIN_EVENTS)).not.toBe(0);
  });

  test("never exceeds ±MAX_BONUS, however lopsided the history", () => {
    const lopsided = buildInterest(
      Array.from({ length: 500 }, (_, i) => row({ listing_id: `x${i}`, dwell_ms: DWELL_CAP_MS })),
      new Map(Array.from({ length: 500 }, (_, i) => [`x${i}`, listing({ id: `x${i}`, balcony: true })]))
    );
    for (const l of [listing({ balcony: true }), listing({ balcony: false, city: "Haifa", rent: 9000 })]) {
      const bonus = affinityBonus(l, lopsided, 500);
      expect(Math.abs(bonus)).toBeLessThanOrEqual(MAX_BONUS);
    }
  });
});

describe("rankByAffinity", () => {
  const liked = listing({ id: "liked", neighborhood: "Florentin", balcony: true });
  const interest = buildInterest(
    [row({ listing_id: "liked", dwell_ms: 30_000 }), row({ listing_id: "liked2", dwell_ms: 30_000 })],
    new Map([["liked", liked], ["liked2", listing({ id: "liked2", neighborhood: "Florentin", balcony: true })]])
  );

  test("promotes a similar room over an equally-scoring dissimilar one", () => {
    const similarRoom = entry(listing({ id: "similar", neighborhood: "Florentin", balcony: true }), 70);
    const otherRoom = entry(listing({ id: "other", neighborhood: "Ramat Aviv", rent: 6000 }), 70);
    const ranked = rankByAffinity([otherRoom, similarRoom], interest, 10);
    expect(ranked[0].listing.id).toBe("similar");
  });

  test("cannot let a weak match overtake a much stronger one — compatibility still rules", () => {
    // Best possible case for the weak room: identical to what the seeker loves.
    const weakButSimilar = entry(listing({ id: "weak", neighborhood: "Florentin", balcony: true }), 62);
    // Worst possible case for the strong room: nothing in common.
    const strongButDifferent = entry(listing({ id: "strong", city: "Haifa", neighborhood: "Bat Galim", rent: 9000 }), 88);
    const ranked = rankByAffinity([weakButSimilar, strongButDifferent], interest, 999);
    expect(ranked[0].listing.id).toBe("strong");
  });

  test("only reorders — it never adds, drops or duplicates a room", () => {
    const deck = [entry(listing({ id: "a" }), 70), entry(listing({ id: "b" }), 75), entry(listing({ id: "c" }), 65)];
    const ranked = rankByAffinity(deck, interest, 10);
    expect(ranked).toHaveLength(deck.length);
    expect([...ranked.map((e) => e.listing.id)].sort()).toEqual(["a", "b", "c"]);
  });

  test("with no history at all, the compatibility order is left untouched", () => {
    const deck = [entry(listing({ id: "a" }), 90), entry(listing({ id: "b" }), 80), entry(listing({ id: "c" }), 70)];
    expect(rankByAffinity(deck, {}, 0).map((e) => e.listing.id)).toEqual(["a", "b", "c"]);
  });
});

describe("withReading", () => {
  test("matches what buildInterest would have produced from the same reading", () => {
    const l = listing({ id: "a", balcony: true });
    const r = row({ listing_id: "a", dwell_ms: 30_000 });
    expect(withReading({}, l, r)).toEqual(buildInterest([r], new Map([["a", l]])));
  });

  test("leaves taste untouched for a reading below the floor", () => {
    const before = { "has:balcony": 0.4 };
    expect(withReading(before, listing({ balcony: true }), row({ dwell_ms: 100 }))).toEqual(before);
  });
});

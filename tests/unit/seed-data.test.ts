import { describe, expect, test } from "vitest";
import {
  CITIES as SEED_CITIES,
  GENERATED_COUNT,
  HANDCRAFTED,
  INTERESTS as SEED_INTERESTS,
  SEEDS,
  generateSeeds,
} from "../../scripts/seed-data";
import { CITIES, INTERESTS, MAX_INTERESTS, MAX_LISTING_PHOTOS, MIN_INTERESTS, MIN_LISTING_PHOTOS, PROPERTY_TYPES } from "@/lib/constants";

const PROPERTY_KEYS = new Set<string>(PROPERTY_TYPES.map((p) => p.key));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("seed data", () => {
  test("duplicated constant lists match lib/constants", () => {
    expect([...SEED_CITIES]).toEqual([...CITIES]);
    expect([...SEED_INTERESTS]).toEqual([...INTERESTS]);
  });

  test("has 12 handcrafted + 80 generated owners with unique emails and names", () => {
    expect(HANDCRAFTED).toHaveLength(12);
    expect(SEEDS).toHaveLength(12 + GENERATED_COUNT);
    expect(new Set(SEEDS.map((s) => s.email)).size).toBe(SEEDS.length);
    expect(new Set(SEEDS.map((s) => s.profile.full_name)).size).toBe(SEEDS.length);
    expect(SEEDS.map((s) => s.email)).toEqual(SEEDS.map((_, i) => `seed.user${i + 1}@nestup.dev`));
  });

  test("generation is deterministic", () => {
    expect(generateSeeds()).toEqual(generateSeeds());
  });

  test("every profile satisfies the profiles table checks", () => {
    for (const { profile: p } of SEEDS) {
      expect(p.full_name.length).toBeGreaterThanOrEqual(2);
      expect(p.full_name.length).toBeLessThanOrEqual(60);
      expect(p.age).toBeGreaterThanOrEqual(18);
      expect(p.age).toBeLessThanOrEqual(120);
      expect(p.bio.length).toBeLessThanOrEqual(500);
      expect(p.cleanliness).toBeGreaterThanOrEqual(1);
      expect(p.cleanliness).toBeLessThanOrEqual(5);
      expect(["early", "late", "flexible"]).toContain(p.sleep_schedule);
      expect(["rare", "sometimes", "often"]).toContain(p.guests_freq);
      expect(p.interests.length).toBeGreaterThanOrEqual(MIN_INTERESTS);
      expect(p.interests.length).toBeLessThanOrEqual(MAX_INTERESTS);
      expect(new Set(p.interests).size).toBe(p.interests.length);
      for (const i of p.interests) expect(INTERESTS).toContain(i);
      for (const c of p.preferred_cities) expect(CITIES).toContain(c);
      expect(p.budget_max === 0 || p.budget_max >= p.budget_min).toBe(true);
      if (p.avatar_url) expect(p.avatar_url).toMatch(/^https:\/\/images\.unsplash\.com\//);
    }
  });

  test("every listing satisfies the listings table checks", () => {
    for (const { listing: l } of SEEDS) {
      expect(l.title.length).toBeGreaterThanOrEqual(5);
      expect(l.title.length).toBeLessThanOrEqual(80);
      expect(l.title).not.toContain("{n}");
      expect(l.description.length).toBeLessThanOrEqual(2000);
      expect(CITIES).toContain(l.city);
      expect(l.neighborhood).not.toBe("");
      expect(l.address.length).toBeLessThanOrEqual(120);
      expect(l.rent).toBeGreaterThan(0);
      expect(l.available_from).toMatch(ISO_DATE);
      expect(PROPERTY_KEYS.has(l.property_type)).toBe(true);
      expect(l.rooms * 2).toBe(Math.round(l.rooms * 2)); // halves only (numeric(3,1))
      expect(l.roommates_count).toBeGreaterThanOrEqual(0);
      expect(l.roommates_count).toBeLessThanOrEqual(10);
      if (l.property_type === "studio") expect(l.roommates_count).toBe(0);
      expect(l.photo_urls.length).toBeGreaterThanOrEqual(MIN_LISTING_PHOTOS);
      expect(l.photo_urls.length).toBeLessThanOrEqual(MAX_LISTING_PHOTOS);
      expect(new Set(l.photo_urls).size).toBe(l.photo_urls.length);
      for (const u of l.photo_urls) expect(u).toMatch(/^https:\/\/images\.unsplash\.com\//);
      expect(l.is_active).toBe(true);
    }
  });

  test("owners who smoke or keep pets list rooms that allow it", () => {
    for (const { profile: p, listing: l } of SEEDS) {
      if (p.smoker) expect(l.smoking_allowed).toBe(true);
      if (p.has_pet) expect(l.pets_allowed).toBe(true);
    }
  });

  test("covers every city and skews toward the centre with affordable rooms", () => {
    const byCity = new Map<string, number>();
    for (const { listing } of SEEDS) byCity.set(listing.city, (byCity.get(listing.city) ?? 0) + 1);
    for (const c of CITIES) expect(byCity.get(c) ?? 0).toBeGreaterThanOrEqual(2);
    expect(byCity.get("Tel Aviv")).toBeGreaterThanOrEqual(25);
    const affordable = SEEDS.filter((s) => s.listing.rent <= 4000).length;
    expect(affordable).toBeGreaterThanOrEqual(45);
  });
});

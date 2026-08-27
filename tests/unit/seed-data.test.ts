import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  CITIES as SEED_CITIES,
  GENERATED_COUNT,
  HANDCRAFTED,
  INTERESTS as SEED_INTERESTS,
  SEEDS,
  WAVE2,
  WAVE2_COUNT,
  WAVE3_CITIES,
  WAVE3_COUNT,
  WAVE3_PER_CITY,
  generateSeeds,
  wave3Rent,
} from "../../scripts/seed-data";
import { CITIES, INTERESTS, MAX_INTERESTS, MAX_LISTING_PHOTOS, MIN_INTERESTS, MIN_LISTING_PHOTOS, PROPERTY_TYPES } from "@/lib/constants";

const PROPERTY_KEYS = new Set<string>(PROPERTY_TYPES.map((p) => p.key));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("seed data", () => {
  test("duplicated constant lists agree with lib/constants", () => {
    for (const c of SEED_CITIES) expect(CITIES).toContain(c); // seeds cover the 12 launch cities of a national list
    expect([...SEED_INTERESTS]).toEqual([...INTERESTS]);
  });

  test("has 12 handcrafted + 80 generated + 62 second-wave + a third wave, all with unique emails and names", () => {
    expect(HANDCRAFTED).toHaveLength(12);
    expect(GENERATED_COUNT).toBe(80);
    expect(WAVE2_COUNT).toBe(62);
    expect(WAVE3_COUNT).toBe(WAVE3_CITIES.length * WAVE3_PER_CITY);
    expect(SEEDS).toHaveLength(12 + GENERATED_COUNT + WAVE2_COUNT + WAVE3_COUNT);
    expect(new Set(SEEDS.map((s) => s.email)).size).toBe(SEEDS.length);
    expect(new Set(SEEDS.map((s) => s.profile.full_name)).size).toBe(SEEDS.length);
    expect(SEEDS.map((s) => s.email)).toEqual(SEEDS.map((_, i) => `seed.user${i + 1}@nestup.dev`));
  });

  test("generation is deterministic", () => {
    expect(generateSeeds()).toEqual(generateSeeds());
    expect(generateSeeds(WAVE2_COUNT, WAVE2)).toEqual(generateSeeds(WAVE2_COUNT, WAVE2));
  });

  test("the first 92 owners are frozen — new waves never rewrite what is already live", () => {
    // Fingerprint of the handcrafted twelve + first generated wave as seeded to the
    // live project on 2026-08-25/26. `scripts/seed.ts` re-syncs photos and lease
    // terms of existing owners from this data, so a change here would silently
    // edit real listings. Bump the hash only when that is the intention.
    const fingerprint = createHash("sha256").update(JSON.stringify(SEEDS.slice(0, 92))).digest("hex");
    expect(fingerprint).toBe("c13c9fb5b720f49d63e5453cff00c2fa70fbf43a809fd8cb5dfbf2d5bc453a47");
    expect(SEEDS.slice(0, 92)).toEqual([...HANDCRAFTED, ...generateSeeds()]);
  });

  test("the second wave has its own portraits and room photos, none shared with the first", () => {
    const first = SEEDS.slice(0, 92);
    const second = SEEDS.slice(92);
    const firstPhotos = new Set(first.flatMap((s) => s.listing.photo_urls));
    const firstPortraits = new Set(first.map((s) => s.profile.avatar_url).filter(Boolean));
    for (const s of second) {
      expect(s.email).toMatch(/^seed\.user\d+@nestup\.dev$/);
      expect(s.profile.avatar_url).toBeTruthy();
      expect(firstPortraits.has(s.profile.avatar_url)).toBe(false);
      for (const u of s.listing.photo_urls) expect(firstPhotos.has(u)).toBe(false);
    }
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
    for (const [index, { listing: l }] of SEEDS.entries()) {
      expect(l.title.length).toBeGreaterThanOrEqual(5);
      expect(l.title.length).toBeLessThanOrEqual(80);
      expect(l.title).not.toContain("{n}");
      expect(l.description.length).toBeLessThanOrEqual(2000);
      expect(CITIES).toContain(l.city);
      // Waves 1 and 2 name a quarter; the third wave covers cities we have no
      // real quarter names for and leaves it blank on purpose (the listing form
      // marks Area optional too, and titles fall back to the city).
      if (index < 154) expect(l.neighborhood).not.toBe("");
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

  test("every room's photo story opens living room → bedroom → bathroom, each tagged", () => {
    for (const { listing: l } of SEEDS) {
      expect(l.photo_labels.length).toBe(l.photo_urls.length);
      expect(l.photo_labels.slice(0, 3)).toEqual(["living_room", "bedroom", "bathroom"]);
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
    // Every city offers a real choice (user request 2026-08-26), Tel Aviv the most.
    for (const c of SEED_CITIES) expect(byCity.get(c) ?? 0).toBeGreaterThanOrEqual(9);
    expect(byCity.get("Tel Aviv")).toBeGreaterThanOrEqual(25);
    const affordable = SEEDS.filter((s) => s.listing.rent <= 4000).length;
    expect(affordable).toBeGreaterThanOrEqual(45);
  });
});

describe("third wave — a room in every city", () => {
  test("covers exactly the cities the first two waves never reached", () => {
    const earlier = new Set(SEEDS.slice(0, 154).map((s) => s.listing.city));
    for (const city of WAVE3_CITIES) expect(earlier.has(city)).toBe(false);
    for (const city of CITIES) {
      expect(earlier.has(city) || WAVE3_CITIES.includes(city), `${city} is not covered`).toBe(true);
    }
  });

  test("every city in the picker ends up with at least three rooms", () => {
    const perCity = new Map<string, number>();
    for (const s of SEEDS) perCity.set(s.listing.city, (perCity.get(s.listing.city) ?? 0) + 1);
    expect(perCity.size).toBe(CITIES.length);
    for (const city of CITIES) {
      expect(perCity.get(city) ?? 0, `${city}`).toBeGreaterThanOrEqual(WAVE3_PER_CITY);
    }
  });

  test("third-wave rooms carry a real street and a title that names the city", () => {
    for (const s of SEEDS.slice(154)) {
      expect(s.listing.neighborhood).toBe("");
      expect(s.listing.address).toMatch(/^[A-Za-z'’\- ]+ \d+$/);
      expect(s.listing.title).toContain(s.listing.city); // no "{n}" left over
      expect(s.listing.title).not.toContain("{n}");
      expect(s.profile.avatar_url).toBeTruthy(); // portraits cycle, nobody is faceless
    }
  });

  test("rent bands stay believable, and the exceptions win over distance", () => {
    for (const s of SEEDS.slice(154)) {
      expect(s.listing.rent).toBeGreaterThanOrEqual(1500);
      expect(s.listing.rent).toBeLessThanOrEqual(5400);
    }
    expect(wave3Rent("Kfar Shmaryahu").min).toBeGreaterThan(wave3Rent("Bnei Brak").min);
    expect(wave3Rent("Bnei Brak").max).toBeLessThan(wave3Rent("Givat Shmuel").max); // central but modest
    expect(wave3Rent("Mitzpe Ramon").max).toBeLessThan(wave3Rent("Ramat HaSharon").max);
  });

  test("nothing of the first two waves moved", () => {
    // The third wave only appends: same emails, same rooms, same order.
    expect(SEEDS.slice(0, 154).map((s) => s.email)).toEqual(
      Array.from({ length: 154 }, (_, i) => `seed.user${i + 1}@nestup.dev`)
    );
    expect(SEEDS[154].email).toBe("seed.user155@nestup.dev");
  });
});

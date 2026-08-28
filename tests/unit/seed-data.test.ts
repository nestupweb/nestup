import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  CITIES as SEED_CITIES,
  GENERATED_COUNT,
  HANDCRAFTED,
  INTERESTS as SEED_INTERESTS,
  SEEDS,
  SEEKERS,
  SEEKER_COUNT,
  WAVE2,
  WAVE2_COUNT,
  WAVE3_CITIES,
  WAVE3_COUNT,
  WAVE3_PER_CITY,
  WAVE4_CITIES,
  WAVE4_COUNT,
  WAVE4_PER_CITY,
  WAVE5_COUNT,
  WAVE5_PER_CITY,
  generateSeeds,
  wave3Rent,
} from "../../scripts/seed-data";
import { MIN_DECK_SCORE, buildDeck } from "@/lib/swipe";
import type { Listing, Profile } from "@/lib/types";

/** Index of the first third-wave owner, and one past the last. */
const WAVE3_START = 154;
const WAVE3_END = WAVE3_START + WAVE3_COUNT;
const WAVE4_END = WAVE3_END + WAVE4_COUNT;
import { CITIES, INTERESTS, MAX_INTERESTS, MAX_LISTING_PHOTOS, MIN_INTERESTS, MIN_LISTING_PHOTOS, PROPERTY_TYPES } from "@/lib/constants";

const PROPERTY_KEYS = new Set<string>(PROPERTY_TYPES.map((p) => p.key));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("seed data", () => {
  test("duplicated constant lists agree with lib/constants", () => {
    for (const c of SEED_CITIES) expect(CITIES).toContain(c); // seeds cover the 12 launch cities of a national list
    expect([...SEED_INTERESTS]).toEqual([...INTERESTS]);
  });

  test("has 12 handcrafted + 80 generated + 62 second-wave + a third and fourth wave, all with unique emails and names", () => {
    expect(HANDCRAFTED).toHaveLength(12);
    expect(GENERATED_COUNT).toBe(80);
    expect(WAVE2_COUNT).toBe(62);
    expect(WAVE3_COUNT).toBe(WAVE3_CITIES.length * WAVE3_PER_CITY);
    expect(WAVE4_COUNT).toBe(WAVE4_CITIES.length * WAVE4_PER_CITY);
    expect(WAVE5_COUNT).toBe(25 * WAVE5_PER_CITY);
    expect(SEEDS).toHaveLength(12 + GENERATED_COUNT + WAVE2_COUNT + WAVE3_COUNT + WAVE4_COUNT + WAVE5_COUNT);
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
    for (const s of SEEDS.slice(WAVE3_START, WAVE3_END)) {
      expect(s.listing.neighborhood).toBe("");
      expect(s.listing.address).toMatch(/^[A-Za-z'’\- ]+ \d+$/);
      expect(s.listing.title).toContain(s.listing.city); // no "{n}" left over
      expect(s.listing.title).not.toContain("{n}");
      expect(s.profile.avatar_url).toBeTruthy(); // portraits cycle, nobody is faceless
    }
  });

  test("rent bands stay believable, and the exceptions win over distance", () => {
    for (const s of SEEDS.slice(WAVE3_START, WAVE3_END)) {
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

describe("fourth wave — two more rooms in every city", () => {
  test("reaches all 124 cities, two rooms each, appended after the first 490", () => {
    expect(WAVE4_PER_CITY).toBe(2);
    expect([...WAVE4_CITIES].sort()).toEqual([...CITIES].sort());
    const fourth = SEEDS.slice(WAVE3_END, WAVE4_END);
    expect(fourth).toHaveLength(WAVE4_COUNT);
    expect(fourth[0].email).toBe(`seed.user${WAVE3_END + 1}@nestup.dev`);
    const perCity = new Map<string, number>();
    for (const s of fourth) perCity.set(s.listing.city, (perCity.get(s.listing.city) ?? 0) + 1);
    for (const city of CITIES) expect(perCity.get(city) ?? 0, `${city}`).toBe(WAVE4_PER_CITY);
  });

  test("every city in the picker now has at least five rooms", () => {
    const perCity = new Map<string, number>();
    for (const s of SEEDS) perCity.set(s.listing.city, (perCity.get(s.listing.city) ?? 0) + 1);
    for (const city of CITIES) {
      expect(perCity.get(city) ?? 0, `${city}`).toBeGreaterThanOrEqual(WAVE3_PER_CITY + WAVE4_PER_CITY);
    }
  });

  test("takes each city as it finds it — launch cities keep their quarter, the rest stay blank", () => {
    for (const s of SEEDS.slice(WAVE3_END, WAVE4_END)) {
      const launch = (SEED_CITIES as readonly string[]).includes(s.listing.city);
      if (launch) expect(s.listing.neighborhood, s.listing.city).not.toBe("");
      else expect(s.listing.neighborhood, s.listing.city).toBe("");
      expect(s.listing.title).toContain(launch ? s.listing.neighborhood : s.listing.city);
      expect(s.listing.title).not.toContain("{n}");
      expect(s.listing.address).toMatch(/^[A-Za-z'’\- ]+ \d+$/);
      expect(s.profile.avatar_url).toBeTruthy(); // portraits cycle, nobody is faceless
    }
  });

  test("nothing of the first three waves moved", () => {
    expect(SEEDS.slice(0, WAVE3_END).map((s) => s.email)).toEqual(
      Array.from({ length: WAVE3_END }, (_, i) => `seed.user${i + 1}@nestup.dev`)
    );
  });
});

/**
 * Turns the seed set into the shape `buildDeck` reads: one owner profile and
 * one room per seed. Ids are positional — nothing here touches the database.
 */
function deckRows() {
  return SEEDS.map((s, i) => ({
    profile: { user_id: `u${i}`, ...s.profile } as unknown as Profile,
    listing: { id: `l${i}`, owner_id: `u${i}`, removed_at: null, ...s.listing } as unknown as Listing,
  }));
}

describe("fifth wave — no city left with a dead deck", () => {
  test("adds three broadly-matching hosts to 25 towns, appended after the first 738", () => {
    const fifth = SEEDS.slice(WAVE4_END);
    expect(fifth).toHaveLength(WAVE5_COUNT);
    expect(fifth[0].email).toBe(`seed.user${WAVE4_END + 1}@nestup.dev`);
    const perCity = new Map<string, number>();
    for (const s of fifth) perCity.set(s.listing.city, (perCity.get(s.listing.city) ?? 0) + 1);
    expect(perCity.size).toBe(25);
    for (const [city, n] of perCity) expect(n, city).toBe(WAVE5_PER_CITY);
    for (const s of fifth) {
      expect(CITIES).toContain(s.listing.city);
      // An easy-going host: no demands, nothing that scores a hard zero.
      expect(s.profile.smoker).toBe(false);
      expect(s.profile.has_pet).toBe(false);
      expect(s.profile.pref_sleep).toBe("any");
      expect(s.profile.pref_guests).toBe("any");
      expect(s.profile.pref_noise).toBe("any");
      expect(s.profile.pref_diet).toBe("any");
      expect(s.profile.pref_shabbat).toBe("any");
      expect(s.profile.interests).toHaveLength(12);
      expect(s.listing.pets_allowed).toBe(true);
      expect(s.listing.smoking_allowed).toBe(true);
    }
  });

  test("nothing of the first four waves moved", () => {
    expect(SEEDS.slice(0, WAVE4_END).map((s) => s.email)).toEqual(
      Array.from({ length: WAVE4_END }, (_, i) => `seed.user${i + 1}@nestup.dev`)
    );
  });

  /**
   * The point of the wave. `MIN_DECK_SCORE` hides anything below "Good", so a
   * town can hold five rooms and still greet every local seeker with "No
   * strong matches yet" — which reads as a broken app. Measured with the real
   * `buildDeck`, using each city's own owners as its seekers.
   */
  test("every city in the picker can fill a swipe deck", () => {
    const rows = deckRows();
    const profiles = rows.map((r) => r.profile);
    const byCity = new Map<string, typeof rows>();
    for (const r of rows) byCity.set(r.listing.city, [...(byCity.get(r.listing.city) ?? []), r]);

    expect(byCity.size).toBe(CITIES.length);
    const dead: string[] = [];
    for (const [city, list] of byCity) {
      const best = Math.max(
        ...list.map(
          (r) => buildDeck(r.profile, list.filter((x) => x !== r).map((x) => x.listing), profiles, []).length
        )
      );
      if (best === 0) dead.push(city);
    }
    expect(dead, `no room scores ${MIN_DECK_SCORE}+ for anyone in these towns`).toEqual([]);
  });
});

/**
 * Seekers — members with a profile and no listing (added for "one person, one
 * home", migration 0033). They are the only accounts the roommate tag picker
 * can offer, so the properties that keep them taggable are the ones worth
 * pinning.
 */
describe("seekers", () => {
  test("there are 25 of them, and none carries a listing", () => {
    expect(SEEKERS).toHaveLength(SEEKER_COUNT);
    expect(SEEKER_COUNT).toBe(25);
    for (const s of SEEKERS) {
      expect(s).not.toHaveProperty("listing");
    }
  });

  test("their emails continue after the last owner, without colliding", () => {
    const ownerEmails = new Set(SEEDS.map((s) => s.email));
    for (const s of SEEKERS) {
      expect(ownerEmails.has(s.email)).toBe(false);
      expect(s.email).toMatch(/^seed\.user\d+@nestup\.dev$/);
    }
    const firstNumber = Number(/user(\d+)@/.exec(SEEKERS[0].email)![1]);
    expect(firstNumber).toBe(SEEDS.length + 1);
    expect(new Set(SEEKERS.map((s) => s.email)).size).toBe(SEEKERS.length);
  });

  test("no seeker shares a name with an owner — the picker must not show twins", () => {
    const ownerNames = new Set(SEEDS.map((s) => s.profile.full_name));
    for (const s of SEEKERS) expect(ownerNames.has(s.profile.full_name)).toBe(false);
    expect(new Set(SEEKERS.map((s) => s.profile.full_name)).size).toBe(SEEKERS.length);
  });

  test("each has a portrait and a complete enough profile to render", () => {
    for (const s of SEEKERS) {
      expect(s.profile.avatar_url).toBeTruthy();
      expect(s.profile.full_name.length).toBeGreaterThan(2);
      expect(s.profile.age).toBeGreaterThanOrEqual(18);
      expect(s.profile.occupation).toBeTruthy();
      expect(s.profile.preferred_cities.length).toBeGreaterThan(0);
    }
  });

  test("portraits come from the eye-checked pool, never a fresh image", () => {
    const owners = new Set(SEEDS.map((s) => s.profile.avatar_url).filter(Boolean));
    for (const s of SEEKERS) expect(owners.has(s.profile.avatar_url)).toBe(true);
  });

  test("generation is deterministic — re-importing gives the same people", async () => {
    const again = (await import("../../scripts/seed-data.ts")).SEEKERS;
    expect(again.map((s) => `${s.email}:${s.profile.full_name}`)).toEqual(
      SEEKERS.map((s) => `${s.email}:${s.profile.full_name}`)
    );
  });
});

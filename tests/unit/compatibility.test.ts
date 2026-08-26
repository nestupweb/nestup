import { describe, expect, test } from "vitest";
import { lifestyleScore, socialScore, scoreLabel, sortKey } from "@/lib/compatibility";
import type { Listing, Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1", full_name: "Test User", age: 25, occupation: "", bio: "",
    avatar_url: null, smoker: false, has_pet: false, cleanliness: 3,
    sleep_schedule: "flexible", guests_freq: "sometimes", noise_level: "moderate", diet: "none", shabbat: "",
    interests: ["Music", "Cooking", "Travel"], chores: [],
    ok_with_smoker: true, ok_with_pets: true,
    pref_cleanliness: 1, pref_sleep: "any", pref_guests: "any", pref_noise: "any", pref_diet: "any", pref_shabbat: "any",
    budget_min: 0, budget_max: 3000, preferred_cities: ["Tel Aviv"],
    earliest_move_in: "2026-10-01", created_at: "", updated_at: "",
    ...overrides,
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l1", owner_id: "u2", title: "Sunlit room in Florentin", description: "",
    city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", rent: 2800,
    available_from: "2026-10-01", property_type: "apartment", rooms: 3, size_sqm: null,
    roommates_count: 2,
    pets_allowed: true, smoking_allowed: false,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    safe_room: "none", food_restrictions: "", street: "Florentin", house_number: "12",
    photo_urls: [], photo_labels: [], viewing_slots: [], is_active: true, created_at: "", updated_at: "",
    ...overrides,
  };
}

const other = (o: Partial<Profile> = {}) => profile({ user_id: "u2", ...o });
const score = (s: Profile, l: Profile, p: "seeker" | "lister" = "seeker", lst: Listing = listing()) => lifestyleScore(s, lst, l, p);

describe("lifestyleScore", () => {
  test("perfect practical fit scores 100", () => {
    const seeker = profile({ cleanliness: 4, sleep_schedule: "early", guests_freq: "rare" });
    const lister = other({ cleanliness: 4, sleep_schedule: "early", guests_freq: "rare" });
    expect(score(seeker, lister)).toBe(100);
  });

  test("rent 10% over budget gets partial budget credit", () => {
    const inBudget = score(profile(), other(), "seeker", listing({ rent: 3000 }));
    const nearBudget = score(profile(), other(), "seeker", listing({ rent: 3200 }));
    const farOver = score(profile(), other(), "seeker", listing({ rent: 4000 }));
    expect(inBudget - nearBudget).toBe(10); // 20 -> 10
    expect(nearBudget - farOver).toBe(10); // 10 -> 0
  });

  test("unset budget is neutral, not zero", () => {
    const noBudget = profile({ budget_max: 0 });
    expect(score(noBudget, other(), "seeker", listing({ rent: 99999 }))).toBeGreaterThan(0);
  });

  test("smoker seeker vs no-smoking listing loses exactly the smoking weight", () => {
    const base = score(profile(), other());
    const s = score(profile({ smoker: true }), other(), "seeker", listing({ smoking_allowed: false }));
    expect(base - s).toBe(10);
  });

  test("is directional: lister who rejects pets scores a pet-owner seeker lower", () => {
    const seekerWithPet = profile({ has_pet: true });
    const strictLister = other({ ok_with_pets: false });
    const seekerView = score(seekerWithPet, strictLister, "seeker", listing({ pets_allowed: true }));
    const listerView = score(seekerWithPet, strictLister, "lister", listing({ pets_allowed: true }));
    expect(listerView).toBeLessThan(seekerView);
  });

  test("move-in 30 days apart gets partial date credit", () => {
    const at = (d: string) => score(profile({ earliest_move_in: "2026-10-01" }), other(), "seeker", listing({ available_from: d }));
    expect(at("2026-10-10")).toBeGreaterThan(at("2026-10-31"));
    expect(at("2026-10-31")).toBeGreaterThan(at("2026-12-30"));
  });

  // --- Daily life: "what I want in roommates" is judged from the viewer's side ---

  test("asking for quiet roommates: a lively one scores 0 on noise, a moderate one keeps full points", () => {
    const wantsQuiet = profile({ noise_level: "quiet", pref_noise: "quiet" });
    const quiet = score(wantsQuiet, other({ noise_level: "quiet" }));
    const moderate = score(wantsQuiet, other({ noise_level: "moderate" }));
    const lively = score(wantsQuiet, other({ noise_level: "lively" }));
    expect(quiet - lively).toBe(4); // whole noise weight
    expect(moderate).toBe(lively); // moderate is over the "quiet" tolerance too
    // Without a requirement, a moderate roommate only loses a little for living differently.
    const relaxed = profile({ noise_level: "quiet" });
    expect(score(relaxed, other({ noise_level: "moderate" }))).toBeGreaterThan(score(relaxed, other({ noise_level: "lively" })));
  });

  test("keeping kosher: only a kosher roommate satisfies the diet requirement; vegetarian accepts vegan", () => {
    const kosher = profile({ diet: "kosher", pref_diet: "kosher" });
    expect(score(kosher, other({ diet: "kosher" })) - score(kosher, other({ diet: "none" }))).toBe(4);
    const veg = profile({ pref_diet: "vegetarian" });
    expect(score(veg, other({ diet: "vegan" }))).toBe(score(veg, other({ diet: "vegetarian" })));
    expect(score(veg, other({ diet: "none" }))).toBeLessThan(score(veg, other({ diet: "vegan" })));
  });

  test("Shabbat: the requirement is checked against how the other person keeps it; 'prefer not to say' is neutral", () => {
    const observant = profile({ shabbat: "observant", pref_shabbat: "observant" });
    expect(score(observant, other({ shabbat: "observant" })) - score(observant, other({ shabbat: "not_observant" }))).toBe(4);
    expect(score(observant, other({ shabbat: "traditional" }))).toBe(score(observant, other({ shabbat: "not_observant" })));
    const unknown = score(observant, other({ shabbat: "" }));
    expect(unknown).toBeGreaterThan(score(observant, other({ shabbat: "not_observant" })));
    expect(unknown).toBeLessThan(score(observant, other({ shabbat: "observant" })));

    const traditional = profile({ pref_shabbat: "traditional" });
    expect(score(traditional, other({ shabbat: "observant" }))).toBe(score(traditional, other({ shabbat: "traditional" })));
    expect(score(traditional, other({ shabbat: "not_observant" }))).toBeLessThan(score(traditional, other({ shabbat: "traditional" })));

    const secular = profile({ pref_shabbat: "not_observant" });
    const s = (v: Profile["shabbat"]) => score(secular, other({ shabbat: v }));
    expect(s("not_observant")).toBeGreaterThan(s("traditional"));
    expect(s("traditional")).toBeGreaterThan(s("observant"));
    // No preference: the row is full points whatever the other person answered.
    expect(score(profile(), other({ shabbat: "observant" }))).toBe(score(profile(), other({ shabbat: "not_observant" })));
  });

  test("guest tolerance: 'rarely, please' zeroes the guests row for a host who often has people over", () => {
    const seeker = profile({ guests_freq: "rare", pref_guests: "rare" });
    const same = score(seeker, other({ guests_freq: "rare" }));
    const often = score(seeker, other({ guests_freq: "often" }));
    expect(same - often).toBe(6);
  });

  test("tidiness expectation: a roommate below the level I ask for loses the requirement points", () => {
    const neat = profile({ cleanliness: 4, pref_cleanliness: 4 });
    const meets = score(neat, other({ cleanliness: 4 }));
    const oneBelow = score(neat, other({ cleanliness: 3 }));
    const twoBelow = score(neat, other({ cleanliness: 2 }));
    expect(meets).toBeGreaterThan(oneBelow);
    expect(oneBelow).toBeGreaterThan(twoBelow);
  });

  test("schedule preference: wanting early risers, a night owl scores 0 and a flexible person partial", () => {
    const early = profile({ sleep_schedule: "early", pref_sleep: "early" });
    const earlyMate = score(early, other({ sleep_schedule: "early" }));
    const flexMate = score(early, other({ sleep_schedule: "flexible" }));
    const owl = score(early, other({ sleep_schedule: "late" }));
    expect(earlyMate - owl).toBe(6);
    expect(flexMate).toBeGreaterThan(owl);
    expect(flexMate).toBeLessThan(earlyMate);
  });

  test("preferences are the viewer's: a lister's noise requirement counts only in the lister's view", () => {
    const loudSeeker = profile({ noise_level: "lively" });
    const quietLister = other({ noise_level: "quiet", pref_noise: "quiet" });
    expect(score(loudSeeker, quietLister, "lister")).toBeLessThan(score(loudSeeker, quietLister, "seeker"));
  });
});

describe("socialScore", () => {
  test("full containment of the smaller set scores 100", () => {
    const a = profile({ interests: ["Music", "Cooking", "Travel"] });
    const b = profile({ interests: ["Music", "Cooking", "Travel", "Gaming", "Hiking"] });
    expect(socialScore(a, b)).toBe(100);
  });
  test("partial overlap", () => {
    const a = profile({ interests: ["Music", "Cooking", "Travel", "Art"] });
    const b = profile({ interests: ["Music", "Gaming", "Hiking", "Tech"] });
    expect(socialScore(a, b)).toBe(25); // 1 shared / min(4,4)
  });
  test("no interests on either side -> null, never 0", () => {
    expect(socialScore(profile({ interests: [] }), profile())).toBeNull();
    expect(socialScore(profile(), profile({ interests: [] }))).toBeNull();
  });
  test("is symmetric", () => {
    const a = profile({ interests: ["Music", "Cooking", "Art"] });
    const b = profile({ interests: ["Art", "Tech", "Gaming", "Music"] });
    expect(socialScore(a, b)).toBe(socialScore(b, a));
  });
  test("duplicate interests cannot inflate the score", () => {
    const spam = profile({ interests: ["Music", "Music", "Cooking"] });
    const o = profile({ interests: ["Music", "Art", "Tech", "Gaming"] });
    expect(socialScore(spam, o)).toBe(50); // dedups to {Music,Cooking}: 1 shared / min(2,4)
    const doubled = profile({ interests: ["Music", "Music"] });
    const single = profile({ interests: ["Music"] });
    expect(socialScore(doubled, single)).toBe(100); // never 200
  });
});

describe("labels and sorting", () => {
  test("label thresholds", () => {
    expect(scoreLabel(80)).toBe("Great fit");
    expect(scoreLabel(79)).toBe("Good");
    expect(scoreLabel(60)).toBe("Good");
    expect(scoreLabel(59)).toBe("Fair");
    expect(scoreLabel(40)).toBe("Fair");
    expect(scoreLabel(39)).toBe("Low");
  });
  test("sortKey averages when social exists, falls back to lifestyle when null", () => {
    expect(sortKey(80, 60)).toBe(70);
    expect(sortKey(80, null)).toBe(80);
  });
});

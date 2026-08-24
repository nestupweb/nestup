import { describe, expect, test } from "vitest";
import { lifestyleScore, socialScore, scoreLabel, sortKey } from "@/lib/compatibility";
import type { Listing, Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1", full_name: "Test User", age: 25, occupation: "", bio: "",
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
    id: "l1", owner_id: "u2", title: "Sunlit room in Florentin", description: "",
    city: "Tel Aviv", neighborhood: "Florentin", rent: 2800,
    available_from: "2026-10-01", roommates_count: 2,
    pets_allowed: true, smoking_allowed: false,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    photo_urls: [], is_active: true, created_at: "", updated_at: "",
    ...overrides,
  };
}

describe("lifestyleScore", () => {
  test("perfect practical fit scores 100", () => {
    const seeker = profile({ cleanliness: 4, sleep_schedule: "early", guests_freq: "rare" });
    const lister = profile({ user_id: "u2", cleanliness: 4, sleep_schedule: "early", guests_freq: "rare" });
    expect(lifestyleScore(seeker, listing(), lister, "seeker")).toBe(100);
  });

  test("rent 10% over budget gets partial budget credit", () => {
    const inBudget = lifestyleScore(profile(), listing({ rent: 3000 }), profile({ user_id: "u2" }), "seeker");
    const nearBudget = lifestyleScore(profile(), listing({ rent: 3200 }), profile({ user_id: "u2" }), "seeker");
    const farOver = lifestyleScore(profile(), listing({ rent: 4000 }), profile({ user_id: "u2" }), "seeker");
    expect(inBudget - nearBudget).toBe(13); // 25 -> 12
    expect(nearBudget - farOver).toBe(12); // 12 -> 0
  });

  test("unset budget is neutral, not zero", () => {
    const noBudget = profile({ budget_max: 0 });
    const s = lifestyleScore(noBudget, listing({ rent: 99999 }), profile({ user_id: "u2" }), "seeker");
    expect(s).toBeGreaterThan(0);
  });

  test("smoker seeker vs no-smoking listing loses exactly the smoking weight", () => {
    const smoker = profile({ smoker: true });
    const base = lifestyleScore(profile(), listing(), profile({ user_id: "u2" }), "seeker");
    const s = lifestyleScore(smoker, listing({ smoking_allowed: false }), profile({ user_id: "u2" }), "seeker");
    expect(base - s).toBe(10);
  });

  test("is directional: lister who rejects pets scores a pet-owner seeker lower", () => {
    const seekerWithPet = profile({ has_pet: true });
    const strictLister = profile({ user_id: "u2", ok_with_pets: false });
    const seekerView = lifestyleScore(seekerWithPet, listing({ pets_allowed: true }), strictLister, "seeker");
    const listerView = lifestyleScore(seekerWithPet, listing({ pets_allowed: true }), strictLister, "lister");
    expect(listerView).toBeLessThan(seekerView);
  });

  test("move-in 30 days apart gets partial date credit", () => {
    const s14 = lifestyleScore(profile({ earliest_move_in: "2026-10-01" }), listing({ available_from: "2026-10-10" }), profile({ user_id: "u2" }), "seeker");
    const s30 = lifestyleScore(profile({ earliest_move_in: "2026-10-01" }), listing({ available_from: "2026-10-31" }), profile({ user_id: "u2" }), "seeker");
    const s90 = lifestyleScore(profile({ earliest_move_in: "2026-10-01" }), listing({ available_from: "2026-12-30" }), profile({ user_id: "u2" }), "seeker");
    expect(s14).toBeGreaterThan(s30);
    expect(s30).toBeGreaterThan(s90);
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

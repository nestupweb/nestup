import { describe, expect, test } from "vitest";
import { matchingSeekers, renderNewMatch, type Candidate } from "@/lib/notify";
import { renderNewMatchText } from "@/lib/email/new-match";
import type { Listing, Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "seeker", full_name: "Seeker", age: 25, occupation: "", bio: "",
    avatar_url: null, smoker: false, has_pet: false, cleanliness: 3,
    sleep_schedule: "flexible", guests_freq: "sometimes",
    interests: ["Music", "Cooking", "Travel"],
    ok_with_smoker: true, ok_with_pets: true,
    noise_level: "moderate", diet: "none", pref_cleanliness: 1, pref_sleep: "any", pref_guests: "any",
    pref_noise: "any", pref_diet: "any", shabbat: "", pref_shabbat: "any", chores: [],
    budget_min: 0, budget_max: 3000, preferred_cities: ["Tel Aviv"],
    earliest_move_in: "2026-10-01", pref_lease_term: "any", pref_safe_room: "any", pref_amenities: [], notify_new_matches: true,
    created_at: "", updated_at: "",
    ...overrides,
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "l1", owner_id: "o1", title: "Sunlit room in Florentin", description: "",
    city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", rent: 2800,
    available_from: "2026-10-01", lease_term: "flexible", property_type: "apartment", rooms: 3, size_sqm: null,
    roommates_count: 2, pets_allowed: true, smoking_allowed: false,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    safe_room: "none", food_restrictions: "", street: "Florentin", house_number: "12", lat: null, lng: null, coords_source: "none",
    photo_urls: ["https://img/1.jpg"], photo_labels: ["living_room"], viewing_slots: [],
    is_active: true, created_at: "", updated_at: "",
    taken_at: null, removed_at: null,
    ...overrides,
  };
}

const owner = profile({ user_id: "o1", interests: ["Music", "Cooking", "Travel"] });
const room = listing();
const candidate = (p: Profile, email = "s@nestup.dev"): Candidate => ({ profile: p, email });

describe("matchingSeekers", () => {
  test("a well-matched member who opted in is selected", () => {
    const picked = matchingSeekers(room, owner, [candidate(profile())]);
    expect(picked.map((c) => c.email)).toEqual(["s@nestup.dev"]);
  });

  test("a member who did not opt in is never mailed", () => {
    expect(matchingSeekers(room, owner, [candidate(profile({ notify_new_matches: false }))])).toEqual([]);
  });

  test("the lister is never mailed about their own room", () => {
    const self = profile({ user_id: "o1", interests: owner.interests });
    expect(matchingSeekers(room, owner, [candidate(self)])).toEqual([]);
  });

  test("a member whose cities exclude the room is skipped", () => {
    expect(matchingSeekers(room, owner, [candidate(profile({ preferred_cities: ["Haifa"] }))])).toEqual([]);
  });

  test("a member whose budget is under the rent is skipped", () => {
    expect(matchingSeekers(room, owner, [candidate(profile({ budget_max: 2000 }))])).toEqual([]);
  });

  test("a member who clears the hard filters but scores too low is skipped", () => {
    // Right city, inside budget — but nothing in common and every daily-life
    // preference at odds, so the combined score lands under MIN_DECK_SCORE.
    const mismatch = profile({
      interests: ["Gaming"], ok_with_smoker: false, ok_with_pets: false,
      pref_cleanliness: 5, pref_sleep: "early", pref_guests: "rare", pref_noise: "quiet",
      pref_diet: "vegan", pref_shabbat: "observant",
    });
    const smokyOwner = profile({
      user_id: "o1", smoker: true, has_pet: true, cleanliness: 1, sleep_schedule: "late",
      guests_freq: "often", noise_level: "lively", diet: "none", shabbat: "not_observant",
      interests: ["Music"],
    });
    expect(matchingSeekers(listing({ smoking_allowed: true }), smokyOwner, [candidate(mismatch)])).toEqual([]);
  });

  test("a member with no e-mail address on file is skipped rather than mailed nowhere", () => {
    expect(matchingSeekers(room, owner, [candidate(profile(), "")])).toEqual([]);
  });
});

describe("renderNewMatch", () => {
  const html = renderNewMatch(room, "https://nestup-kappa.vercel.app");

  test("carries the room, the price and a link straight to it", () => {
    expect(html).toContain("Sunlit room in Florentin");
    expect(html).toContain("2,800");
    expect(html).toContain("https://nestup-kappa.vercel.app/browse/l1");
  });

  test("always offers a way out", () => {
    expect(html).toContain("https://nestup-kappa.vercel.app/settings");
  });

  test("leaves no placeholder unreplaced", () => {
    expect(html).not.toMatch(/\{\{/);
  });
});

describe("renderNewMatchText", () => {
  const text = renderNewMatchText(room, "https://nestup-kappa.vercel.app");

  test("is real prose with the room, price and link — not stripped markup", () => {
    expect(text).toContain("Sunlit room in Florentin");
    expect(text).toContain("2,800");
    expect(text).toContain("https://nestup-kappa.vercel.app/browse/l1");
    expect(text).not.toContain("<");
  });

  test("carries the way to switch these e-mails off", () => {
    expect(text).toContain("https://nestup-kappa.vercel.app/settings");
  });
});

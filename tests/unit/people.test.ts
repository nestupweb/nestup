import { describe, expect, test } from "vitest";
import { formatClock, profileGroups, socialHref } from "@/lib/people";
import type { Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1", full_name: "Dana Levi", age: 29, occupation: "Architect", bio: "",
    avatar_url: null, smoker: false, has_pet: true, cleanliness: 4,
    sleep_schedule: "early", guests_freq: "sometimes",
    interests: ["Cooking"], ok_with_smoker: false, ok_with_pets: true,
    noise_level: "moderate", diet: "none", pref_cleanliness: 1, pref_sleep: "any", pref_guests: "any", pref_noise: "any", pref_diet: "any",
    shabbat: "traditional", pref_shabbat: "any", chores: ["Dishes"], gender: null, pref_same_gender: false,
    budget_min: 2500, budget_max: 4000, preferred_cities: ["Tel Aviv", "Haifa"],
    earliest_move_in: "2026-10-01", pref_lease_term: "any", pref_safe_room: "any", pref_amenities: [], notify_new_matches: false, created_at: "", updated_at: "",
    ...overrides,
  };
}

const details = {
  about: "Hi!", languages: ["Hebrew", "English"], diet: "Vegetarian", pet_details: "a cat named Tuna",
  lifestyle: "WFH", wake_time: "07:30", bed_time: "23:15", shabbat: "traditional" as const, cooking: "Most evenings",
  instagram: "@dana.levi", facebook: "Dana Levi", linkedin: "linkedin.com/in/danalevi",
  phone: "+972 50-123-4567", contact_email: "dana@example.com",
};

describe("formatClock", () => {
  test("drops the leading zero and rejects junk", () => {
    expect(formatClock("07:30")).toBe("7:30");
    expect(formatClock("23:15")).toBe("23:15");
    expect(formatClock("")).toBe("");
    expect(formatClock("7am")).toBe("");
  });
});

describe("socialHref", () => {
  test("handles handles, bare domains and full URLs", () => {
    expect(socialHref("instagram", "@dana.levi")).toBe("https://instagram.com/dana.levi");
    expect(socialHref("linkedin", "linkedin.com/in/danalevi")).toBe("https://linkedin.com/in/danalevi");
    expect(socialHref("linkedin", "danalevi")).toBe("https://linkedin.com/in/danalevi");
    expect(socialHref("facebook", "https://www.facebook.com/dana")).toBe("https://www.facebook.com/dana");
  });
  test("free text (a display name) gets no link", () => {
    expect(socialHref("facebook", "Dana Levi")).toBeUndefined();
    expect(socialHref("instagram", "")).toBeUndefined();
  });
});

describe("profileGroups", () => {
  test("groups the shareable details and never includes contact info", () => {
    const groups = profileGroups(profile(), details);
    const titles = groups.map((g) => g.title);
    // Smoking / pets / tidiness / schedule / guests / noise / diet / Shabbat are
    // the Daily life table (lib/daily-life.ts); the social links are the
    // header's ContactRow — neither shows up as rows here.
    expect(titles).toEqual(["My day", "Habits & home", "Looking for"]);
    const rows = Object.fromEntries(groups.flatMap((g) => g.rows.map((r) => [r.label, r])));
    expect(rows["Wake-up time"].value).toBe("7:30");
    expect(rows["Shabbat"]).toBeUndefined();
    expect(rows["Sleep schedule"]).toBeUndefined();
    expect(rows["Languages"].value).toBe("Hebrew, English");
    expect(rows["Pet"].value).toBe("a cat named Tuna");
    expect(rows["Smoking"]).toBeUndefined();
    expect(rows["Budget"].value).toBe("₪2,500–₪4,000 / month");
    expect(rows["Move-in"].value).toBe("1 Oct 2026");
    expect(rows["Preferred cities"].value).toBe("Tel Aviv, Haifa");
    expect(rows["Instagram"]).toBeUndefined();
    expect(rows["Facebook"]).toBeUndefined();
    expect(rows["Phone number"]).toBeUndefined();
    expect(rows["Email address"]).toBeUndefined();
  });

  test("shows 'For how long' only when a term is chosen", () => {
    const rowsOf = (p: Parameters<typeof profileGroups>[0]) =>
      profileGroups(p, null).find((g) => g.title === "Looking for")?.rows.map((r) => r.label) ?? [];
    expect(rowsOf(profile())).not.toContain("For how long");
    expect(rowsOf(profile({ pref_lease_term: "year" }))).toContain("For how long");
    const row = profileGroups(profile({ pref_lease_term: "year" }), null)
      .find((g) => g.title === "Looking for")!
      .rows.find((r) => r.label === "For how long")!;
    expect(row.value).toBe("A year");
  });

  test("shows the mamad only when one is asked for", () => {
    const rowsOf = (p: Parameters<typeof profileGroups>[0]) =>
      profileGroups(p, null).find((g) => g.title === "Looking for")?.rows.map((r) => r.label) ?? [];
    expect(rowsOf(profile())).not.toContain("Mamad");
    expect(rowsOf(profile({ pref_safe_room: "has" }))).toContain("Mamad");
    const row = profileGroups(profile({ pref_safe_room: "building" }), null)
      .find((g) => g.title === "Looking for")!
      .rows.find((r) => r.label === "Mamad")!;
    expect(row.value).toBe("In the building");
  });

  test("lists the amenities asked for, and says nothing when none are", () => {
    const rowsOf = (p: Parameters<typeof profileGroups>[0]) =>
      profileGroups(p, null).find((g) => g.title === "Looking for")?.rows.map((r) => r.label) ?? [];
    expect(rowsOf(profile())).not.toContain("Amenities");
    const row = profileGroups(profile({ pref_amenities: ["balcony", "air_conditioning"] }), null)
      .find((g) => g.title === "Looking for")!
      .rows.find((r) => r.label === "Amenities")!;
    expect(row.value).toBe("Balcony, Air conditioning");
  });

  test("drops empty rows and groups when there are no details", () => {
    const groups = profileGroups(
      profile({ occupation: "", has_pet: false, budget_min: 0, budget_max: 0, preferred_cities: [], earliest_move_in: null }),
      null
    );
    expect(groups).toEqual([]); // everything else lives in the Daily life table
    const withJob = profileGroups(profile({ has_pet: false, budget_min: 0, budget_max: 0, preferred_cities: [], earliest_move_in: null }), null);
    expect(withJob.map((g) => g.title)).toEqual(["My day"]);
    expect(withJob[0].rows.map((r) => r.label)).toEqual(["Occupation"]);
  });
});

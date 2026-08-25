import { describe, expect, test } from "vitest";
import { formatClock, profileGroups, socialHref } from "@/lib/people";
import type { Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1", full_name: "Dana Levi", age: 29, occupation: "Architect", bio: "",
    avatar_url: null, smoker: false, has_pet: true, cleanliness: 4,
    sleep_schedule: "early", guests_freq: "sometimes",
    interests: ["Cooking"], ok_with_smoker: false, ok_with_pets: true,
    budget_min: 2500, budget_max: 4000, preferred_cities: ["Tel Aviv", "Haifa"],
    earliest_move_in: "2026-10-01", created_at: "", updated_at: "",
    ...overrides,
  };
}

const details = {
  about: "Hi!", languages: ["Hebrew", "English"], diet: "Vegetarian", pet_details: "a cat named Tuna",
  lifestyle: "WFH", wake_time: "07:30", bed_time: "23:15", shabbat: "traditional" as const, cooking: "Most evenings",
  instagram: "@dana.levi", facebook: "Dana Levi", linkedin: "linkedin.com/in/danalevi",
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
    expect(titles).toEqual(["Daily life", "Habits & home", "Social", "Looking for"]);
    const rows = Object.fromEntries(groups.flatMap((g) => g.rows.map((r) => [r.label, r])));
    expect(rows["Wake-up time"].value).toBe("7:30");
    expect(rows["Shabbat"].value).toBe("Traditional");
    expect(rows["Sleep schedule"].value).toBe("Early bird");
    expect(rows["Languages"].value).toBe("Hebrew, English");
    expect(rows["Pets"].value).toBe("Yes — a cat named Tuna");
    expect(rows["Smoking"].value).toBe("Non-smoker");
    expect(rows["Budget"].value).toBe("₪2,500–₪4,000 / month");
    expect(rows["Move-in"].value).toBe("1 Oct 2026");
    expect(rows["Preferred cities"].value).toBe("Tel Aviv, Haifa");
    expect(rows["Instagram"].href).toBe("https://instagram.com/dana.levi");
    expect(rows["Facebook"].href).toBeUndefined();
    expect(rows["Phone number"]).toBeUndefined();
    expect(rows["Email address"]).toBeUndefined();
  });

  test("drops empty rows and groups when there are no details", () => {
    const groups = profileGroups(
      profile({ occupation: "", has_pet: false, budget_min: 0, budget_max: 0, preferred_cities: [], earliest_move_in: null }),
      null
    );
    expect(groups.map((g) => g.title)).toEqual(["Daily life", "Habits & home"]);
    expect(groups[0].rows.map((r) => r.label)).toEqual(["Sleep schedule"]);
    expect(groups[1].rows.map((r) => r.value)).toEqual(["No pets", "Non-smoker", "4/5", "Guests sometimes"]);
  });
});

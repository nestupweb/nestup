import { describe, expect, test } from "vitest";
import { isApartmentPrefsComplete, listLabels, missingApartmentPrefs } from "@/lib/apartment-prefs";

/** A member who has said what they want from a flat: a budget and a city. */
const filled = {
  budget_min: 2000,
  budget_max: 4500,
  preferred_cities: ["Tel Aviv"],
};

describe("what Swipe requires of Apartment preferences", () => {
  test("a filled-in section opens the deck", () => {
    expect(isApartmentPrefsComplete(filled)).toBe(true);
    expect(missingApartmentPrefs(filled)).toEqual([]);
  });

  test("a profile that does not exist yet is missing both", () => {
    expect(missingApartmentPrefs(null)).toEqual(["Monthly budget", "Preferred cities"]);
  });

  test.each([
    [{ budget_min: 0, budget_max: 0 }, "Monthly budget"],
    [{ preferred_cities: [] }, "Preferred cities"],
  ])("names the one that is empty (%j)", (gap, label) => {
    const p = { ...filled, ...gap };
    expect(isApartmentPrefsComplete(p)).toBe(false);
    expect(missingApartmentPrefs(p)).toEqual([label]);
  });

  /**
   * The regression this file exists for (2026-09-01): "Earliest move-in" used
   * to be required, so a member who left the date on its "Any time" default —
   * a real answer, the field is clearable — opened Swipe to "No suggested
   * listings yet" with a full budget and five cities saved. A blank date costs
   * one neutral dimension in the score, never the whole deck.
   */
  test("a blank move-in date never holds the deck shut", () => {
    expect(isApartmentPrefsComplete({ ...filled, earliest_move_in: null })).toBe(true);
    expect(missingApartmentPrefs({ ...filled, earliest_move_in: null })).toEqual([]);
    expect(missingApartmentPrefs(null)).not.toContain("Earliest move-in");
  });

  /**
   * Either handle of the budget slider counts (user decision, 2026-08-30): a
   * floor is as much of an answer as a ceiling. Both parked at the ends is the
   * "Any budget" no-op the gate exists to catch.
   */
  test("a minimum alone is a budget, and so is a maximum alone", () => {
    expect(isApartmentPrefsComplete({ ...filled, budget_max: 0 })).toBe(true);
    expect(isApartmentPrefsComplete({ ...filled, budget_min: 0 })).toBe(true);
    expect(isApartmentPrefsComplete({ ...filled, budget_min: 0, budget_max: 0 })).toBe(false);
  });

  /**
   * Amenities and "For how long" stay optional: both keep "No preference" as a
   * real answer, so neither can be told apart from an untouched field.
   */
  test("amenities and the lease term never hold the deck shut", () => {
    const bare = { ...filled, pref_amenities: [], pref_safe_room: "any", pref_lease_term: "any" };
    expect(isApartmentPrefsComplete(bare)).toBe(true);
  });
});

test("listLabels reads as a sentence", () => {
  expect(listLabels([])).toBe("");
  expect(listLabels(["Monthly budget"])).toBe("Monthly budget");
  expect(listLabels(["Monthly budget", "Preferred cities"])).toBe("Monthly budget and Preferred cities");
  expect(listLabels(["A", "B", "C"])).toBe("A, B and C");
});

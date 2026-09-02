import { describe, expect, test } from "vitest";
import { FINISH_APARTMENT_PREFS, NEEDS_CITY, SWIPE_NEEDS_CITY, hasPreferredCity } from "@/lib/apartment-prefs";

/** A member who has said where they want to live — and a lot they didn't have to. */
const filled = {
  budget_min: 2000,
  budget_max: 4500,
  preferred_cities: ["Tel Aviv"],
  earliest_move_in: "2026-10-01",
};

describe("what Swipe requires of Apartment preferences", () => {
  test("one preferred city opens the deck", () => {
    expect(hasPreferredCity(filled)).toBe(true);
    expect(hasPreferredCity({ preferred_cities: ["Haifa", "Netanya"] })).toBe(true);
  });

  test("no city, no matches — and that is the whole rule", () => {
    expect(hasPreferredCity({ ...filled, preferred_cities: [] })).toBe(false);
  });

  test("a profile that does not exist yet has not named a city either", () => {
    expect(hasPreferredCity(null)).toBe(false);
    expect(hasPreferredCity(undefined)).toBe(false);
    expect(hasPreferredCity({})).toBe(false);
  });

  /**
   * The change this file now guards (user, 2026-09-02): the budget used to be a
   * second requirement, so a member who knew exactly which city they wanted but
   * had not settled on a number opened Swipe to "No suggested listings yet".
   * An empty budget already means "any rent" to `fitsHardFilters`; it never
   * needed to close the deck.
   */
  test("an empty budget never holds the deck shut", () => {
    expect(hasPreferredCity({ ...filled, budget_min: 0, budget_max: 0 })).toBe(true);
  });

  /**
   * Same reasoning for the rest of the section: move-in stopped gating on
   * 2026-09-01, and amenities and "For how long" never did — each offers a
   * blank or "No preference" as a real answer.
   */
  test("neither does a blank move-in, or amenities left alone", () => {
    expect(hasPreferredCity({ ...filled, earliest_move_in: null })).toBe(true);
    expect(hasPreferredCity({ preferred_cities: ["Tel Aviv"] })).toBe(true);
  });
});

/**
 * The round trip a save with no city makes: profile action → Swipe with the
 * flag → the prompt's button → the form, banner showing. Asserted here because
 * three files agree on these strings and only this one owns them.
 */
test("the no-city flow's two routes stay in step", () => {
  expect(SWIPE_NEEDS_CITY).toBe(`/swipe?needs=${NEEDS_CITY}`);
  expect(FINISH_APARTMENT_PREFS).toBe("/profile/edit?needs=apartment-prefs");
});

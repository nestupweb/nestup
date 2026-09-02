import type { Profile } from "@/lib/types";

/**
 * What Swipe requires before it will recommend anything: one preferred city.
 *
 * One rule, and only one (user decision, 2026-09-02). Location is the answer a
 * deck cannot be built without — `fitsHardFilters` drops every room outside the
 * seeker's cities before anything is scored, so a member who has named none is
 * asking to be ranked against the whole country by nothing they said about
 * where they want to live. Every other answer on the form sharpens the ranking;
 * this one decides whether there is a ranking at all.
 *
 * "Monthly budget" was a second requirement until 2026-09-02 and is now
 * optional like the rest of the section: a member who hasn't settled on what
 * they can pay still knows which city they want, and 0 already means "any rent"
 * to the filter rather than an empty answer. Earliest move-in stopped gating on
 * 2026-09-01, and amenities and "For how long" never did — all of them offer a
 * blank or "No preference" as a real answer, so a member who deliberately has
 * no preference is indistinguishable from one who never looked, and gating on
 * any of them locks out people who have in fact answered.
 *
 * A profile with no city still SAVES — nothing here blocks the form; the four
 * basics in `profileSchema` are the only things that do. What an empty city
 * list costs is matches, and that is said twice: as a modal on the Swipe page
 * the save lands on (`NoCityPrompt`), and on the form when they come back.
 *
 * One rule, shared: the Swipe page gates on it, `getCachedDeck` backstops it,
 * `upsertProfileAction` routes on it, and the profile form marks the field.
 */
export type ApartmentPrefs = Pick<
  Profile,
  // The whole section, though only `preferred_cities` is the rule. The others
  // still feed the hard filters and the compatibility score — they simply never
  // close the deck on their own.
  "budget_min" | "budget_max" | "preferred_cities" | "earliest_move_in"
>;

/**
 * Has this member named at least one city — the single question every match
 * query is gated on? Null-safe, because a profile that doesn't exist yet has
 * not named one either.
 */
export function hasPreferredCity(p: Partial<ApartmentPrefs> | null | undefined): boolean {
  return (p?.preferred_cities?.length ?? 0) > 0;
}

/**
 * Where a member goes to add the city, and how Swipe is told to ask for it.
 *
 * Saving a profile with no city lands on `SWIPE_NEEDS_CITY` (see
 * `upsertProfileAction`); `/swipe` reads the flag off the query string and
 * opens `NoCityPrompt`, whose "Edit profile" button points back at
 * `FINISH_APARTMENT_PREFS` — the form with the Apartment preferences banner
 * already showing, so the field is named on arrival rather than hunted for.
 */
export const NEEDS_CITY = "cities";
export const SWIPE_NEEDS_CITY = `/swipe?needs=${NEEDS_CITY}`;
export const FINISH_APARTMENT_PREFS = "/profile/edit?needs=apartment-prefs";

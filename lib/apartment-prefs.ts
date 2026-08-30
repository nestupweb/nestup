import type { Profile } from "@/lib/types";

/**
 * What "Apartment preferences" has to say before Swipe will recommend anything.
 *
 * Three answers, and they are exactly the three the match score reads: without
 * a budget, a city or a move-in date `lib/compatibility.ts` scores every room
 * as neutral, so a deck built on them is ranked by nothing the member said.
 * That is what this gate exists to prevent — see `/swipe`.
 *
 * Amenities (the mamad and the nice-to-haves) stay optional, and so does "For
 * how long": both offer "No preference" as a real answer, and the columns
 * default to it, so a member who deliberately has no preference is
 * indistinguishable from one who never looked — gating on either would lock
 * out people who have in fact answered.
 *
 * One rule, shared: the Swipe page reads it, `getCachedDeck` backstops it, and
 * the profile form uses it to say what is still missing.
 */
export type ApartmentPrefs = Pick<
  Profile,
  "budget_min" | "budget_max" | "preferred_cities" | "earliest_move_in"
>;

type PrefRule = {
  key: string;
  /** As it reads in the form, so "what's missing" names something findable. */
  label: string;
  filled: (p: Partial<ApartmentPrefs>) => boolean;
};

export const APARTMENT_PREF_RULES: readonly PrefRule[] = [
  {
    key: "budget",
    label: "Monthly budget",
    // Either handle counts: a floor is as much of an answer as a ceiling, and
    // both sliders parked at the ends is the "Any budget" no-op.
    filled: (p) => (p.budget_min ?? 0) > 0 || (p.budget_max ?? 0) > 0,
  },
  {
    key: "preferred_cities",
    label: "Preferred cities",
    filled: (p) => (p.preferred_cities?.length ?? 0) > 0,
  },
  {
    key: "earliest_move_in",
    label: "Earliest move-in",
    filled: (p) => Boolean(p.earliest_move_in),
  },
];

/** The preferences still waiting on an answer, in form order, by their labels. */
export function missingApartmentPrefs(p: Partial<ApartmentPrefs> | null | undefined): string[] {
  if (!p) return APARTMENT_PREF_RULES.map((r) => r.label);
  return APARTMENT_PREF_RULES.filter((r) => !r.filled(p)).map((r) => r.label);
}

/** Has this member said enough for a deck to be worth ranking? */
export function isApartmentPrefsComplete(p: Partial<ApartmentPrefs> | null | undefined): boolean {
  return missingApartmentPrefs(p).length === 0;
}

/** "Monthly budget", "Monthly budget and Preferred cities", "a, b and c". */
export function listLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

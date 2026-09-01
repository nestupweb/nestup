import { z } from "zod";
import { CITIES, GENDERS, LEASE_TERMS, SAFE_ROOM_FILTERS } from "@/lib/constants";
import type { Gender, LeaseTerm } from "@/lib/types";

/**
 * Two options, and only two (user decision, 2026-09-01): an all-male household
 * or an all-female one. It used to offer all four `GENDERS` plus an `any` that
 * meant "all the same, I don't mind which" — five entries for a filter people
 * reach for to say one of two things. "Other" and "Prefer not to say" also
 * never matched much: `household_gender` is only set when EVERY member states
 * the same gender, so those two were near-empty searches dressed as choices.
 *
 * Old links still work: `?household_gender=any` (or `=other`) no longer parses
 * and is caught to `undefined`, i.e. the room list is simply unfiltered.
 */
const householdGenderKeys = ["male", "female"] as const satisfies readonly Gender[];

const optionalInt = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}, z.number().int().min(0).optional());

const optionalBool = z.preprocess(
  (v) => (v === "true" || v === true ? true : v === "false" || v === false ? false : undefined),
  z.boolean().optional()
);

/** Browse ordering: newest first, or by monthly rent either way. */
export const LISTING_SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
] as const;
export type ListingSort = (typeof LISTING_SORTS)[number]["key"];
const sortKeys = LISTING_SORTS.map((s) => s.key) as [ListingSort, ...ListingSort[]];
const leaseTermKeys = LEASE_TERMS.map((t) => t.key) as [LeaseTerm, ...LeaseTerm[]];
type SafeRoomFilter = (typeof SAFE_ROOM_FILTERS)[number]["key"];
const safeRoomKeys = SAFE_ROOM_FILTERS.map((o) => o.key) as [SafeRoomFilter, ...SafeRoomFilter[]];

export const listingFiltersSchema = z.object({
  sort: z.enum(sortKeys).default("newest").catch("newest"),
  city: z.enum(CITIES).optional().catch(undefined),
  rent_min: optionalInt.catch(undefined),
  rent_max: optionalInt.catch(undefined),
  move_in_by: z.iso.date().optional().catch(undefined),
  lease_term: z.enum(leaseTermKeys).optional().catch(undefined), // "for how long" — exact term
  // Mamad: "has" is any of them, the other two are the exact place.
  safe_room: z.enum(safeRoomKeys).optional().catch(undefined),
  /**
   * "All roommates of the same gender", and which one. Matched against the
   * listing's derived `household_gender` (0037), which is null unless every
   * member of the household stated the same gender — so this never returns a
   * room where somebody simply hasn't said.
   */
  household_gender: z.enum(householdGenderKeys).optional().catch(undefined),
  roommates_max: optionalInt.catch(undefined),
  pets_allowed: optionalBool.catch(undefined),
  smoking_allowed: optionalBool.catch(undefined),
  balcony: optionalBool.catch(undefined),
  air_conditioning: optionalBool.catch(undefined),
  parking: optionalBool.catch(undefined),
  elevator: optionalBool.catch(undefined),
  furnished: optionalBool.catch(undefined),
  page: z.preprocess((v) => Math.max(1, Number(v) || 1), z.number().int().min(1)).default(1),
  page_size: z.preprocess((v) => {
    const n = Number(v) || 20;
    return n < 1 || n > 50 ? 20 : Math.trunc(n);
  }, z.number().int()).default(20),
});

export type ListingFilters = z.infer<typeof listingFiltersSchema>;

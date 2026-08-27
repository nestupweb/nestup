import { z } from "zod";
import { CITIES } from "@/lib/constants";

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
  { key: "price_desc", label: "Price: high to low" },
  { key: "price_asc", label: "Price: low to high" },
] as const;
export type ListingSort = (typeof LISTING_SORTS)[number]["key"];
const sortKeys = LISTING_SORTS.map((s) => s.key) as [ListingSort, ...ListingSort[]];

export const listingFiltersSchema = z.object({
  sort: z.enum(sortKeys).default("newest").catch("newest"),
  city: z.enum(CITIES).optional().catch(undefined),
  rent_min: optionalInt.catch(undefined),
  rent_max: optionalInt.catch(undefined),
  move_in_by: z.iso.date().optional().catch(undefined),
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

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

export const listingFiltersSchema = z.object({
  city: z.enum(CITIES).optional().catch(undefined),
  rent_min: optionalInt.catch(undefined),
  rent_max: optionalInt.catch(undefined),
  move_in_by: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
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

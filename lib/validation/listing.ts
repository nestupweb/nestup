import { z } from "zod";
import { CITIES, PROPERTY_TYPES } from "@/lib/constants";
import type { PropertyType } from "@/lib/types";

const propertyTypeKeys = PROPERTY_TYPES.map((p) => p.key) as [PropertyType, ...PropertyType[]];

export const listingSchema = z.object({
  title: z.string().trim().min(5).max(80),
  description: z.string().trim().max(2000).default(""),
  city: z.enum(CITIES),
  neighborhood: z.string().trim().max(80).default(""),
  rent: z.coerce.number().int().positive(),
  available_from: z.iso.date(),
  property_type: z.enum(propertyTypeKeys).default("apartment"),
  rooms: z.coerce.number().min(1).max(12).multipleOf(0.5).default(3),
  size_sqm: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(10).max(1000).nullable()
  ).default(null),
  roommates_count: z.coerce.number().int().min(0).max(10),
  pets_allowed: z.coerce.boolean().default(false),
  smoking_allowed: z.coerce.boolean().default(false),
  balcony: z.coerce.boolean().default(false),
  air_conditioning: z.coerce.boolean().default(false),
  parking: z.coerce.boolean().default(false),
  elevator: z.coerce.boolean().default(false),
  furnished: z.coerce.boolean().default(false),
});

export type ListingInput = z.infer<typeof listingSchema>;

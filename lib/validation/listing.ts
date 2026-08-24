import { z } from "zod";
import { CITIES } from "@/lib/constants";

export const listingSchema = z.object({
  title: z.string().trim().min(5).max(80),
  description: z.string().trim().max(2000).default(""),
  city: z.enum(CITIES),
  neighborhood: z.string().trim().max(80).default(""),
  rent: z.coerce.number().int().positive(),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

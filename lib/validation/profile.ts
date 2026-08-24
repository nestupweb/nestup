import { z } from "zod";
import { CITIES, INTERESTS, MAX_INTERESTS, MIN_INTERESTS } from "@/lib/constants";

export const profileSchema = z
  .object({
    full_name: z.string().trim().min(2).max(60),
    age: z.coerce.number().int().min(18).max(120),
    occupation: z.string().trim().max(80).default(""),
    bio: z.string().trim().max(500).default(""),
    smoker: z.coerce.boolean().default(false),
    has_pet: z.coerce.boolean().default(false),
    cleanliness: z.coerce.number().int().min(1).max(5),
    sleep_schedule: z.enum(["early", "late", "flexible"]),
    guests_freq: z.enum(["rare", "sometimes", "often"]),
    interests: z
      .array(z.enum(INTERESTS))
      .min(MIN_INTERESTS, "Select at least 3 interests")
      .max(MAX_INTERESTS)
      .refine((arr) => new Set(arr).size === arr.length, "Interests must be unique"),
    ok_with_smoker: z.coerce.boolean().default(false),
    ok_with_pets: z.coerce.boolean().default(false),
    budget_min: z.coerce.number().int().min(0).default(0),
    budget_max: z.coerce.number().int().min(0).default(0),
    preferred_cities: z.array(z.enum(CITIES)).default([]),
    earliest_move_in: z.iso.date().nullable().default(null),
  })
  .refine((p) => p.budget_max === 0 || p.budget_max >= p.budget_min, {
    message: "Max budget must be at least the min budget",
    path: ["budget_max"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;

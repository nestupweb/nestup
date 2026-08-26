import { z } from "zod";
import { BUDGET_CAP, CITIES, INTERESTS, MAX_INTERESTS, MIN_INTERESTS } from "@/lib/constants";

export const profileSchema = z
  .object({
    full_name: z.string().trim().min(2).max(60),
    age: z.coerce.number().int().min(18).max(120),
    occupation: z.string().trim().max(80).default(""),
    bio: z.string().trim().max(500).default(""),
    // --- Daily life: how I live ---
    smoker: z.coerce.boolean().default(false),
    has_pet: z.coerce.boolean().default(false),
    cleanliness: z.coerce.number().int().min(1).max(5),
    sleep_schedule: z.enum(["early", "late", "flexible"]),
    guests_freq: z.enum(["rare", "sometimes", "often"]),
    noise_level: z.enum(["quiet", "moderate", "lively"]).default("moderate"),
    diet: z.enum(["none", "kosher", "vegetarian", "vegan", "halal", "gluten_free", "other"]).default("none"),
    interests: z
      .array(z.enum(INTERESTS))
      .min(MIN_INTERESTS, "Select at least 3 interests")
      .max(MAX_INTERESTS)
      .refine((arr) => new Set(arr).size === arr.length, "Interests must be unique"),
    // --- Daily life: what I want in flatmates ---
    ok_with_smoker: z.coerce.boolean().default(false),
    ok_with_pets: z.coerce.boolean().default(false),
    pref_cleanliness: z.coerce.number().int().min(1).max(5).default(1),
    pref_sleep: z.enum(["any", "early", "late"]).default("any"),
    pref_guests: z.enum(["any", "rare", "sometimes"]).default("any"),
    pref_noise: z.enum(["any", "quiet", "moderate"]).default("any"),
    pref_diet: z.enum(["any", "kosher", "vegetarian", "vegan"]).default("any"),
    // --- Apartment preferences ---
    budget_min: z.coerce.number().int().min(0).max(BUDGET_CAP).default(0),
    budget_max: z.coerce.number().int().min(0).max(BUDGET_CAP).default(0), // 0 = no max
    preferred_cities: z.array(z.enum(CITIES)).default([]),
    earliest_move_in: z.iso.date().nullable().default(null),
  })
  .refine((p) => p.budget_max === 0 || p.budget_max >= p.budget_min, {
    message: "Max budget must be at least the min budget",
    path: ["budget_max"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;

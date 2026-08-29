import { z } from "zod";
import { BUDGET_CAP, CHORES, CITIES, INTERESTS, MAX_INTERESTS, MIN_INTERESTS, PREF_LEASE_TERMS, PREF_SAFE_ROOMS } from "@/lib/constants";
import type { PrefLeaseTerm, PrefSafeRoom } from "@/lib/types";

const prefLeaseTermKeys = PREF_LEASE_TERMS.map((o) => o.key) as [PrefLeaseTerm, ...PrefLeaseTerm[]];
const prefSafeRoomKeys = PREF_SAFE_ROOMS.map((o) => o.key) as [PrefSafeRoom, ...PrefSafeRoom[]];

/**
 * The Daily life table may be saved half-finished (migration 0035): a blank
 * select is `null`, "not answered yet", and saving is never blocked by one.
 * /swipe is what requires the full table — see `isDailyLifeComplete`.
 */
const blank = <T extends z.ZodTypeAny>(answer: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), answer.nullable().default(null));

/** A yes/no row. "" is unanswered, and stays distinguishable from a plain No. */
const yesNo = z.preprocess(
  (v) => (v === "yes" || v === true || v === "on" ? true : v === "no" || v === false ? false : null),
  z.boolean().nullable().default(null)
);

/**
 * Shabbat carries two different empty answers: `null` is "not answered", and
 * the empty string is the member choosing "Prefer not to say", which scores as
 * neutral. The form sends the latter as a word so the two survive a round-trip
 * through an HTML select, where every blank option has the same value.
 */
const PREFER_NOT_TO_SAY = "prefer_not_to_say";
const shabbatAnswer = z.preprocess(
  (v) => (v === PREFER_NOT_TO_SAY ? "" : v === "" || v === undefined ? null : v),
  z.enum(["", "observant", "traditional", "not_observant"]).nullable().default(null)
);

export const profileSchema = z
  .object({
    full_name: z.string().trim().min(2).max(60),
    age: z.coerce.number().int().min(18).max(120),
    occupation: z.string().trim().max(80).default(""),
    bio: z.string().trim().max(500).default(""),
    // --- Daily life: how I live (blank = not answered yet, 0035) ---
    smoker: yesNo,
    has_pet: yesNo,
    cleanliness: blank(z.coerce.number().int().min(1).max(5)),
    sleep_schedule: blank(z.enum(["early", "late", "flexible"])),
    guests_freq: blank(z.enum(["rare", "sometimes", "often"])),
    noise_level: blank(z.enum(["quiet", "moderate", "lively"])),
    diet: blank(z.enum(["none", "kosher", "vegetarian", "vegan", "halal", "gluten_free", "other"])),
    shabbat: shabbatAnswer,
    interests: z
      .array(z.enum(INTERESTS))
      .min(MIN_INTERESTS, "Select at least 3 interests")
      .max(MAX_INTERESTS)
      .refine((arr) => new Set(arr).size === arr.length, "Interests must be unique"),
    // --- Household chores I'm happy to take on ---
    chores: z
      .array(z.enum(CHORES))
      .max(CHORES.length)
      .default([])
      .transform((arr) => [...new Set(arr)]),
    // --- Daily life: what I want in roommates (blank = not answered yet) ---
    ok_with_smoker: yesNo,
    ok_with_pets: yesNo,
    pref_cleanliness: blank(z.coerce.number().int().min(1).max(5)),
    pref_sleep: blank(z.enum(["any", "early", "late"])),
    pref_guests: blank(z.enum(["any", "rare", "sometimes"])),
    pref_noise: blank(z.enum(["any", "quiet", "moderate"])),
    pref_diet: blank(z.enum(["any", "kosher", "vegetarian", "vegan"])),
    pref_shabbat: blank(z.enum(["any", "observant", "traditional", "not_observant"])),
    // --- Apartment preferences ---
    budget_min: z.coerce.number().int().min(0).max(BUDGET_CAP).default(0),
    budget_max: z.coerce.number().int().min(0).max(BUDGET_CAP).default(0), // 0 = no max
    preferred_cities: z.array(z.enum(CITIES)).default([]),
    earliest_move_in: z.iso.date().nullable().default(null),
    // "For how long" — optional so onboarding and older forms still validate.
    pref_lease_term: z.enum(prefLeaseTermKeys).default("any"),
    pref_safe_room: z.enum(prefSafeRoomKeys).default("any"),
  })
  .refine((p) => p.budget_max === 0 || p.budget_max >= p.budget_min, {
    message: "Max budget must be at least the min budget",
    path: ["budget_max"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;

export { PREFER_NOT_TO_SAY };

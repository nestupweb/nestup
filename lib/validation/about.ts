import { z } from "zod";

export const SHABBAT_OPTIONS = [
  { key: "", label: "Prefer not to say" },
  { key: "observant", label: "Observant" },
  { key: "traditional", label: "Traditional" },
  { key: "not_observant", label: "Not observant" },
] as const;

const text = (max: number) => z.string().trim().max(max).default("");
const clock = z
  .string()
  .trim()
  .regex(/^(\d{2}:\d{2})?$/, "Use HH:MM")
  .default("");

/** The `profile_details` columns (no `profiles` mirrors). */
export const aboutDetailsSchema = z.object({
  about: text(3000),
  languages: z.preprocess(
    (v) =>
      String(v ?? "")
        .split(/[,،;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    z.array(z.string().max(40)).max(12)
  ),
  diet: text(120),
  pet_details: text(120),
  lifestyle: text(200),
  wake_time: clock,
  bed_time: clock,
  shabbat: z.enum(["", "observant", "traditional", "not_observant"]).catch(""),
  cooking: text(120),
  phone: text(30),
  contact_email: z.union([z.literal(""), z.email("Enter a valid email")]).default(""),
  instagram: text(120),
  facebook: text(160),
  linkedin: text(160),
  intro_template: text(500),
});

export type AboutDetailsInput = z.infer<typeof aboutDetailsSchema>;

/** Reads the About-me detail fields off a submitted form (raw, for the schema). */
export function aboutDetailsFromForm(formData: FormData): Record<keyof AboutDetailsInput, FormDataEntryValue | string> {
  const get = (k: string) => formData.get(k) ?? "";
  return {
    about: get("about"),
    languages: get("languages"),
    diet: get("diet"),
    pet_details: get("pet_details"),
    lifestyle: get("lifestyle"),
    wake_time: get("wake_time"),
    bed_time: get("bed_time"),
    shabbat: get("shabbat"),
    cooking: get("cooking"),
    phone: get("phone"),
    contact_email: get("contact_email"),
    instagram: get("instagram"),
    facebook: get("facebook"),
    linkedin: get("linkedin"),
    intro_template: get("intro_template"),
  };
}

/** Everything on the About me tab — `profile_details` fields plus the few `profiles` ones shown there. */
export const aboutSchema = z
  .object({
    about: text(3000),
    languages: z.preprocess(
      (v) =>
        String(v ?? "")
          .split(/[,،;\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      z.array(z.string().max(40)).max(12)
    ),
    diet: text(120),
    pet_details: text(120),
    lifestyle: text(200),
    wake_time: clock,
    bed_time: clock,
    shabbat: z.enum(["", "observant", "traditional", "not_observant"]).catch(""),
    cooking: text(120),
    phone: text(30),
    contact_email: z.union([z.literal(""), z.email("Enter a valid email")]).default(""),
    instagram: text(120),
    facebook: text(160),
    linkedin: text(160),
    intro_template: text(500),
    // mirrored on `profiles`
    occupation: text(80),
    smoker: z.coerce.boolean().default(false),
    has_pet: z.coerce.boolean().default(false),
    budget_min: z.coerce.number().int().min(0).default(0),
    budget_max: z.coerce.number().int().min(0).default(0),
    earliest_move_in: z.iso.date().nullable().default(null),
  })
  .refine((p) => p.budget_max === 0 || p.budget_max >= p.budget_min, {
    message: "Max budget must be at least the min budget",
    path: ["budget_max"],
  });

export type AboutInput = z.infer<typeof aboutSchema>;

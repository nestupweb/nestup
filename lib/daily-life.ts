import {
  CLEANLINESS_LEVELS,
  DIETS,
  GUEST_FREQS,
  NOISE_LEVELS,
  PREF_CLEANLINESS,
  PREF_DIET,
  PREF_GUESTS,
  PREF_NOISE,
  PREF_SHABBAT,
  PREF_SLEEP,
  SHABBAT_LEVELS,
  SLEEP_SCHEDULES,
  genderLabel,
  optionLabel,
} from "@/lib/constants";
import type { Profile } from "@/lib/types";

export type DailyLifeRow = { key: string; label: string; mine: string; wants: string };

/** Shown in place of an answer nobody has given. */
export const UNANSWERED = "—";

/**
 * The sixteen answers of the Daily life table, in table order.
 *
 * `shabbat` is the one that is complete at the empty string: "Prefer not to
 * say" is a real choice there and scores as neutral, so only `null` means
 * unanswered.
 */
export const DAILY_LIFE_FIELDS = [
  "smoker", "ok_with_smoker",
  "has_pet", "ok_with_pets",
  "cleanliness", "pref_cleanliness",
  "sleep_schedule", "pref_sleep",
  "guests_freq", "pref_guests",
  "noise_level", "pref_noise",
  "diet", "pref_diet",
  "shabbat", "pref_shabbat",
] as const satisfies readonly (keyof Profile)[];

/** Anything carrying the sixteen answers: a profile row, or a parsed form. */
export type DailyLifeAnswers = Partial<Pick<Profile, (typeof DAILY_LIFE_FIELDS)[number]>>;

/**
 * Has this member answered the whole table?
 *
 * Nothing is gated on it since 2026-08-30 — the table is optional, and what an
 * unfinished one costs is the sharpness of the match scores, said as a warning
 * above the Save button rather than a locked deck. /swipe's own requirement is
 * `isApartmentPrefsComplete`. Mirrored in SQL as
 * `public.is_daily_life_complete` (migration 0035), which nothing calls.
 */
export function isDailyLifeComplete(p: DailyLifeAnswers | null | undefined): boolean {
  if (!p) return false;
  return DAILY_LIFE_FIELDS.every((f) => p[f] !== null && p[f] !== undefined);
}

/** The rows still waiting on an answer, for "3 answers to go". */
export function unansweredCount(p: DailyLifeAnswers | null | undefined): number {
  if (!p) return DAILY_LIFE_FIELDS.length;
  return DAILY_LIFE_FIELDS.filter((f) => p[f] === null || p[f] === undefined).length;
}

/** A profile whose Daily life answers are all present — what scoring needs. */
export type AnsweredProfile = Profile & {
  [K in (typeof DAILY_LIFE_FIELDS)[number]]: NonNullable<Profile[K]>;
};

/**
 * A profile with every unanswered row replaced by the value the column used to
 * default to, so scoring sees exactly what it saw before migration 0035 and no
 * existing match score moves. Scoring runs against OTHER members too, and they
 * may not have finished the table — a null must read as "no signal", never as
 * a mismatch.
 */
export function withDailyLifeDefaults(p: Profile): AnsweredProfile {
  return {
    ...p,
    smoker: p.smoker ?? false,
    has_pet: p.has_pet ?? false,
    cleanliness: p.cleanliness ?? 3,
    sleep_schedule: p.sleep_schedule ?? "flexible",
    guests_freq: p.guests_freq ?? "sometimes",
    noise_level: p.noise_level ?? "moderate",
    diet: p.diet ?? "none",
    shabbat: p.shabbat ?? "",
    ok_with_smoker: p.ok_with_smoker ?? true,
    ok_with_pets: p.ok_with_pets ?? true,
    pref_cleanliness: p.pref_cleanliness ?? 1,
    pref_sleep: p.pref_sleep ?? "any",
    pref_guests: p.pref_guests ?? "any",
    pref_noise: p.pref_noise ?? "any",
    pref_diet: p.pref_diet ?? "any",
    pref_shabbat: p.pref_shabbat ?? "any",
  };
}

/**
 * The Daily life table as words — one row per habit, "how I live" beside
 * "what I want in roommates". Shared by the read-only profile view and any
 * place that summarises a member.
 */
export function dailyLifeRows(p: Profile): DailyLifeRow[] {
  // An unanswered row reads as "—", never as the answer the column used to
  // default to (0035). `yesNo` keeps `false` — a real answer — distinct from
  // `null`, which the `??` in a plain ternary would have swallowed.
  const yesNo = (v: boolean | null, yes: string, no: string) => (v === null ? UNANSWERED : v ? yes : no);
  const pick = <K extends string | number>(options: readonly { key: K; label: string }[], v: K | null) =>
    v === null ? UNANSWERED : optionLabel(options, v);

  return [
    { key: "smoking", label: "Smoking", mine: yesNo(p.smoker, "Smoker", "Non-smoker"), wants: yesNo(p.ok_with_smoker, "Fine with a smoker", "Non-smokers only") },
    { key: "pets", label: "Pets", mine: yesNo(p.has_pet, "Has a pet", "No pets"), wants: yesNo(p.ok_with_pets, "Pets welcome", "No pets, please") },
    { key: "cleanliness", label: "Cleanliness", mine: pick(CLEANLINESS_LEVELS, p.cleanliness as 1 | 2 | 3 | 4 | 5 | null), wants: pick(PREF_CLEANLINESS, p.pref_cleanliness as 1 | 2 | 3 | 4 | 5 | null) },
    { key: "schedule", label: "Schedule", mine: pick(SLEEP_SCHEDULES, p.sleep_schedule), wants: pick(PREF_SLEEP, p.pref_sleep) },
    { key: "guests", label: "Guests", mine: pick(GUEST_FREQS, p.guests_freq), wants: pick(PREF_GUESTS, p.pref_guests) },
    { key: "noise", label: "Noise", mine: pick(NOISE_LEVELS, p.noise_level), wants: pick(PREF_NOISE, p.pref_noise) },
    { key: "diet", label: "Dietary restrictions", mine: pick(DIETS, p.diet), wants: pick(PREF_DIET, p.pref_diet) },
    { key: "shabbat", label: "Shabbat", mine: pick(SHABBAT_LEVELS, p.shabbat), wants: pick(PREF_SHABBAT, p.pref_shabbat) },
    // Read-only, so the left cell can show the gender the member stated on
    // their profile — in the editor that cell is a note, because gender is
    // asked once, beside their age.
    {
      key: "gender",
      label: "Gender",
      mine: p.gender ? genderLabel(p.gender) : UNANSWERED,
      wants: p.pref_same_gender ? "Roommates of my gender" : "Any gender",
    },
  ];
}

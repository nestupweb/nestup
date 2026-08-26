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
  optionLabel,
} from "@/lib/constants";
import type { Profile } from "@/lib/types";

export type DailyLifeRow = { key: string; label: string; mine: string; wants: string };

/**
 * The Daily life table as words — one row per habit, "how I live" beside
 * "what I want in roommates". Shared by the read-only profile view and any
 * place that summarises a member.
 */
export function dailyLifeRows(p: Profile): DailyLifeRow[] {
  return [
    { key: "smoking", label: "Smoking", mine: p.smoker ? "Smoker" : "Non-smoker", wants: p.ok_with_smoker ? "Fine with a smoker" : "Non-smokers only" },
    { key: "pets", label: "Pets", mine: p.has_pet ? "Has a pet" : "No pets", wants: p.ok_with_pets ? "Pets welcome" : "No pets, please" },
    { key: "cleanliness", label: "Cleanliness", mine: optionLabel(CLEANLINESS_LEVELS, p.cleanliness as 1 | 2 | 3 | 4 | 5), wants: optionLabel(PREF_CLEANLINESS, p.pref_cleanliness as 1 | 2 | 3 | 4 | 5) },
    { key: "schedule", label: "Schedule", mine: optionLabel(SLEEP_SCHEDULES, p.sleep_schedule), wants: optionLabel(PREF_SLEEP, p.pref_sleep) },
    { key: "guests", label: "Guests", mine: optionLabel(GUEST_FREQS, p.guests_freq), wants: optionLabel(PREF_GUESTS, p.pref_guests) },
    { key: "noise", label: "Noise", mine: optionLabel(NOISE_LEVELS, p.noise_level), wants: optionLabel(PREF_NOISE, p.pref_noise) },
    { key: "diet", label: "Dietary restrictions", mine: optionLabel(DIETS, p.diet), wants: optionLabel(PREF_DIET, p.pref_diet) },
    { key: "shabbat", label: "Shabbat", mine: optionLabel(SHABBAT_LEVELS, p.shabbat ?? ""), wants: optionLabel(PREF_SHABBAT, p.pref_shabbat ?? "any") },
  ];
}

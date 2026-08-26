import { SHABBAT_OPTIONS } from "@/lib/validation/about";
import type { Profile, ProfileDetails } from "@/lib/types";

/**
 * What another signed-in member may see of someone's "About me" — everything
 * including phone and contact e-mail (user decision, migration 0020); only the
 * private default hello template stays out.
 */
export type PublicDetails = Pick<
  ProfileDetails,
  | "about"
  | "languages"
  | "diet"
  | "pet_details"
  | "lifestyle"
  | "wake_time"
  | "bed_time"
  | "shabbat"
  | "cooking"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "phone"
  | "contact_email"
>;

export type ProfileRow = { label: string; value: string; href?: string };
export type ProfileGroup = { title: string; rows: ProfileRow[] };


/** "07:30" → "7:30", "" → "" (times are stored as HH:MM). */
export function formatClock(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  return `${Number(m[1])}:${m[2]}`;
}

export function shabbatLabel(key: string): string {
  return SHABBAT_OPTIONS.find((o) => o.key === key && o.key !== "")?.label ?? "";
}

export { socialHref } from "@/lib/social";

function shekels(n: number): string {
  return `₪${n.toLocaleString("en-US")}`;
}

function budgetLabel(p: Profile): string {
  if (p.budget_min > 0 && p.budget_max > 0) return `${shekels(p.budget_min)}–${shekels(p.budget_max)} / month`;
  if (p.budget_max > 0) return `Up to ${shekels(p.budget_max)} / month`;
  if (p.budget_min > 0) return `From ${shekels(p.budget_min)} / month`;
  return "";
}

function moveInLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The read-only view of a member's profile, grouped the same way they filled
 * it in. Smoking / pets / tidiness / schedule / guests / noise / diet /
 * Shabbat are the Daily life table (lib/daily-life.ts), the social links are
 * the header's ContactRow — these are the remaining details. Empty fields are
 * dropped; empty groups too.
 */
export function profileGroups(profile: Profile, details: PublicDetails | null): ProfileGroup[] {
  const d = details;
  const groups: ProfileGroup[] = [
    {
      title: "My day",
      rows: [
        { label: "Occupation", value: profile.occupation },
        { label: "Daily lifestyle", value: d?.lifestyle ?? "" },
        { label: "Wake-up time", value: formatClock(d?.wake_time ?? "") },
        { label: "Bedtime", value: formatClock(d?.bed_time ?? "") },
        { label: "Cooking", value: d?.cooking ?? "" },
      ],
    },
    {
      title: "Habits & home",
      rows: [
        { label: "Languages", value: (d?.languages ?? []).join(", ") },
        { label: "Pet", value: profile.has_pet ? (d?.pet_details?.trim() ?? "") : "" },
      ],
    },
    {
      title: "Looking for",
      rows: [
        { label: "Budget", value: budgetLabel(profile) },
        { label: "Move-in", value: moveInLabel(profile.earliest_move_in) },
        { label: "Preferred cities", value: profile.preferred_cities.join(", ") },
      ],
    },
  ];
  return groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => r.value.trim() !== "") }))
    .filter((g) => g.rows.length > 0);
}

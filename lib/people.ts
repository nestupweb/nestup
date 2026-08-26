import { SHABBAT_OPTIONS } from "@/lib/validation/about";
import type { Profile, ProfileDetails } from "@/lib/types";

/** What another member may see of someone's "About me" — no phone / e-mail. */
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
import { socialHref } from "@/lib/social";

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
 * it in on their About me tab. Empty fields are dropped; empty groups too.
 */
export function profileGroups(profile: Profile, details: PublicDetails | null): ProfileGroup[] {
  const d = details;
  const groups: ProfileGroup[] = [
    {
      // Smoking / pets / tidiness / schedule / guests / noise / diet live in the
      // Daily life table (DailyLifeView) — these are the free-text extras.
      title: "My day",
      rows: [
        { label: "Occupation", value: profile.occupation },
        { label: "Daily lifestyle", value: d?.lifestyle ?? "" },
        { label: "Wake-up time", value: formatClock(d?.wake_time ?? "") },
        { label: "Bedtime", value: formatClock(d?.bed_time ?? "") },
        { label: "Shabbat", value: shabbatLabel(d?.shabbat ?? "") },
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
      title: "Social",
      rows: [
        { label: "Instagram", value: d?.instagram ?? "", href: socialHref("instagram", d?.instagram ?? "") },
        { label: "Facebook", value: d?.facebook ?? "", href: socialHref("facebook", d?.facebook ?? "") },
        { label: "LinkedIn", value: d?.linkedin ?? "", href: socialHref("linkedin", d?.linkedin ?? "") },
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

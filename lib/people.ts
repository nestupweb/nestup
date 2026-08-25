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

const SLEEP: Record<Profile["sleep_schedule"], string> = {
  early: "Early bird",
  late: "Night owl",
  flexible: "Flexible",
};
const GUESTS: Record<Profile["guests_freq"], string> = {
  rare: "Rarely has guests",
  sometimes: "Guests sometimes",
  often: "Often has guests",
};

/** "07:30" → "7:30", "" → "" (times are stored as HH:MM). */
export function formatClock(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  return `${Number(m[1])}:${m[2]}`;
}

export function shabbatLabel(key: string): string {
  return SHABBAT_OPTIONS.find((o) => o.key === key && o.key !== "")?.label ?? "";
}

/** Turns a handle, bare domain or full URL into something a link can open. */
export function socialHref(kind: "instagram" | "facebook" | "linkedin", raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.)?(instagram|facebook|linkedin)\.com\//i.test(v)) return `https://${v.replace(/^www\./i, "")}`;
  const handle = v.replace(/^@/, "");
  if (!/^[\w.\-/]+$/.test(handle)) return undefined; // free text like "Dana Levi" — no link
  if (kind === "instagram") return `https://instagram.com/${handle}`;
  if (kind === "facebook") return `https://facebook.com/${handle}`;
  return `https://linkedin.com/in/${handle.replace(/^in\//, "")}`;
}

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
      title: "Daily life",
      rows: [
        { label: "Occupation", value: profile.occupation },
        { label: "Daily lifestyle", value: d?.lifestyle ?? "" },
        { label: "Wake-up time", value: formatClock(d?.wake_time ?? "") },
        { label: "Bedtime", value: formatClock(d?.bed_time ?? "") },
        { label: "Sleep schedule", value: SLEEP[profile.sleep_schedule] ?? "" },
        { label: "Shabbat", value: shabbatLabel(d?.shabbat ?? "") },
        { label: "Cooking", value: d?.cooking ?? "" },
      ],
    },
    {
      title: "Habits & home",
      rows: [
        { label: "Languages", value: (d?.languages ?? []).join(", ") },
        { label: "Dietary habits", value: d?.diet ?? "" },
        {
          label: "Pets",
          value: profile.has_pet ? (d?.pet_details?.trim() ? `Yes — ${d.pet_details.trim()}` : "Yes") : "No pets",
        },
        { label: "Smoking", value: profile.smoker ? "Smoker" : "Non-smoker" },
        { label: "Tidiness", value: `${profile.cleanliness}/5` },
        { label: "Guests", value: GUESTS[profile.guests_freq] ?? "" },
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

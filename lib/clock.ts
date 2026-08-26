/**
 * Wake-up / bedtime on the profile are approximate, optional full hours.
 * Times are stored as "HH:MM" (or "" for not set), as they always were.
 */

/** "07:40" → "08:00", "23:45" → "00:00"; "" or junk → "" (not set). */
export function nearestHour(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  const h = (Number(m[1]) + (Number(m[2]) >= 30 ? 1 : 0)) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

/** The hour list for a select, keeping the member's current value selectable even if it is off-list. */
export function hourChoices(list: readonly string[], current: string): string[] {
  return current && !list.includes(current) ? [...list, current] : [...list];
}

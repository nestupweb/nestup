/** Pure date/label helpers for the chat UI. Locale-dependent — call on the client. */

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysAgo(iso: string, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
}

/** "Today", "Yesterday", a weekday within the week, else a long date. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = daysAgo(iso, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Inbox row timestamp: time today, "Yesterday", weekday this week, else dd/mm/yy. */
export function previewTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = daysAgo(iso, now);
  if (diff === 0) return timeLabel(iso);
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Splits a chronologically sorted timeline into per-day groups with display labels. */
export function groupByDay<T extends { created_at: string }>(
  items: T[],
  now: Date = new Date()
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const key = String(startOfDay(new Date(item.created_at)));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(item.created_at, now), items: [item] });
  }
  return groups;
}

/** Long date + time range for a viewing card ("Tue 26 Aug · 18:00–18:45"). */
export function viewingLabel(startsAt: string, endsAt: string): { date: string; time: string } {
  const start = new Date(startsAt);
  return {
    date: start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    time: `${timeLabel(startsAt)}–${timeLabel(endsAt)}`,
  };
}

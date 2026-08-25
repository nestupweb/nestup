/**
 * Viewing hours: an owner's weekly windows for apartment viewings, stored on
 * the listing as `viewing_slots`. Pure helpers shared by the listing form, the
 * chat scheduler, the server action that validates a request, and tests.
 */

export interface ViewingSlot {
  day: number; // 0 = Sunday … 6 = Saturday (Israeli week starts on Sunday)
  from: string; // "HH:MM"
  to: string; // "HH:MM", after `from`
}

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Any time when the owner hasn't set hours — the previous behaviour. */
export const DEFAULT_HOURS = { from: "08:00", to: "21:30" } as const;
export const LISTING_TIME_ZONE = "Asia/Jerusalem";
export const MAX_VIEWING_SLOTS = 21;

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMinutes(hhmm: string): number | null {
  const m = CLOCK.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Keeps only well-formed slots (valid day, HH:MM, to > from), sorted by day then start. */
export function normalizeSlots(raw: unknown): ViewingSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: ViewingSlot[] = [];
  for (const item of raw.slice(0, MAX_VIEWING_SLOTS)) {
    if (!item || typeof item !== "object") continue;
    const { day, from, to } = item as Record<string, unknown>;
    const d = Number(day);
    if (!Number.isInteger(d) || d < 0 || d > 6) continue;
    if (typeof from !== "string" || typeof to !== "string") continue;
    const f = toMinutes(from);
    const t = toMinutes(to);
    if (f === null || t === null || t <= f) continue;
    out.push({ day: d, from, to });
  }
  return out.sort((a, b) => a.day - b.day || a.from.localeCompare(b.from));
}

export function slotsForDay(slots: ViewingSlot[], day: number): ViewingSlot[] {
  return slots.filter((s) => s.day === day);
}

/** Weekdays a seeker may pick, or null when the owner set no hours (any day). */
export function allowedWeekdays(slots: ViewingSlot[]): number[] | null {
  if (slots.length === 0) return null;
  return [...new Set(slots.map((s) => s.day))].sort();
}

/**
 * Start times ("HH:MM") on a given weekday for which a viewing of
 * `durationMin` still ends inside one of the owner's windows.
 */
export function startTimes(slots: ViewingSlot[], day: number, durationMin: number, step = 30): string[] {
  const windows =
    slots.length === 0 ? [{ from: DEFAULT_HOURS.from, to: DEFAULT_HOURS.to }] : slotsForDay(slots, day);
  const times = new Set<string>();
  for (const w of windows) {
    const from = toMinutes(w.from);
    const to = toMinutes(w.to);
    if (from === null || to === null) continue;
    // Start on a step boundary at or after the window opens.
    for (let t = Math.ceil(from / step) * step; t + durationMin <= to; t += step) times.add(fromMinutes(t));
  }
  return [...times].sort();
}

/** Weekday + minutes-since-midnight of an instant, in the listing's time zone. */
export function localParts(iso: string, timeZone = LISTING_TIME_ZONE): { day: number; minutes: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = (DAY_SHORT as readonly string[]).indexOf(get("weekday"));
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  if (day < 0 || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { day, minutes: hour * 60 + minute };
}

/** True when [start, end] sits inside one of the owner's windows (or there are none). */
export function fitsAvailability(slots: ViewingSlot[], startISO: string, endISO: string, timeZone = LISTING_TIME_ZONE): boolean {
  if (slots.length === 0) return true;
  const s = localParts(startISO, timeZone);
  const e = localParts(endISO, timeZone);
  if (!s || !e || s.day !== e.day || e.minutes < s.minutes) return false;
  return slotsForDay(slots, s.day).some((w) => {
    const from = toMinutes(w.from)!;
    const to = toMinutes(w.to)!;
    return s.minutes >= from && e.minutes <= to;
  });
}

/** "Sun–Thu 17:00–20:00", "Fri 10:00–13:00" — consecutive days with identical hours are merged. */
export function describeSlots(slots: ViewingSlot[]): string[] {
  const sorted = normalizeSlots(slots);
  const lines: string[] = [];
  let run: { start: number; end: number; range: string } | null = null;
  const flush = () => {
    if (!run) return;
    const days = run.start === run.end ? DAY_SHORT[run.start] : `${DAY_SHORT[run.start]}–${DAY_SHORT[run.end]}`;
    lines.push(`${days} ${run.range}`);
    run = null;
  };
  for (const s of sorted) {
    const range = `${s.from}–${s.to}`;
    if (run && run.range === range && s.day === run.end + 1) {
      run.end = s.day;
    } else {
      flush();
      run = { start: s.day, end: s.day, range };
    }
  }
  flush();
  return lines;
}

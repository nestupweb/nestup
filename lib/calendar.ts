/** Pure calendar helpers shared by the viewing action, the viewing card, and tests. */

export const VIEWING_DURATIONS = [30, 45, 60] as const;
export type ViewingDuration = (typeof VIEWING_DURATIONS)[number];

const MAX_AHEAD_MS = 180 * 24 * 60 * 60 * 1000; // six months

/** `20260826T150000Z` — the compact UTC form Google Calendar links expect. */
export function toGoogleDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface CalendarLinkInput {
  title: string;
  details?: string;
  location?: string;
  start: Date;
  end: Date;
  guests?: string[];
}

/** Pre-filled "create event" link — works for anyone with a Google account, no OAuth needed. */
export function googleCalendarTemplateUrl(input: CalendarLinkInput): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${toGoogleDate(input.start)}/${toGoogleDate(input.end)}`,
  });
  if (input.details) params.set("details", input.details);
  if (input.location) params.set("location", input.location);
  if (input.guests && input.guests.length > 0) params.set("add", input.guests.join(","));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function isValidViewingStart(iso: string, now: Date = new Date()): boolean {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > now.getTime() && t < now.getTime() + MAX_AHEAD_MS;
}

export function viewingWindow(startsAt: string, durationMinutes: number): { start: Date; end: Date } {
  const start = new Date(startsAt);
  return { start, end: new Date(start.getTime() + durationMinutes * 60_000) };
}

export interface ViewingListing {
  title: string;
  address: string;
  city: string;
  rent: number;
}

/** Event copy shared by the OAuth-created event and the template link. */
export function describeViewing(
  listing: ViewingListing,
  withName: string,
  note: string,
  chatUrl?: string
): { summary: string; description: string; location: string } {
  const location = [listing.address, listing.city].filter(Boolean).join(", ");
  const lines = [
    `Apartment viewing — ${listing.title}`,
    location,
    `₪${listing.rent.toLocaleString()} / month`,
    `With ${withName}`,
  ];
  if (note) lines.push("", `Note: ${note}`);
  if (chatUrl) lines.push("", `Chat: ${chatUrl}`);
  return {
    summary: `Viewing: ${listing.title}`,
    description: lines.join("\n"),
    location,
  };
}

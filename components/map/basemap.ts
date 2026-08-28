/**
 * Basemap styles for the mapcn map component (`components/ui/map.tsx`).
 *
 * mapcn's own cartography — CARTO's Positron and Dark Matter — served from our
 * origin with one change: every label asks for its English name first
 * (`scripts/build-english-basemaps.mjs`). CARTO's published styles print the
 * tiles' local `name`, which in Israel is Hebrew.
 *
 * Positron deliberately draws almost no shops or cafés; those come from
 * `app/api/places/route.ts` and are drawn as our own pins, so the map shows
 * what's around a room without swapping cartography for a busier provider.
 */
export const MAP_STYLES = {
  light: "/maplibre/positron-en.json",
  dark: "/maplibre/dark-matter-en.json",
} as const;

/**
 * MapLibre paints its own layers, so the pins can't be styled in CSS: these
 * are the palette values from globals.css, written out for the GL renderer.
 * `tests/unit/map-basemap.test.ts` fails if they drift from the stylesheet.
 *
 * `accent` fills a room's pin and `on` draws its outline and centre dot — the
 * accent's contrast colour, so the pin reads against the tiles underneath it.
 */
export const MAP_COLORS = {
  light: {
    accent: "#2e7d5e",
    on: "#faf7f2",
    ring: "#faf7f2",
  },
  dark: {
    accent: "#c9a468",
    on: "#191613",
    ring: "#191613",
  },
} as const;

/** What a nearby place is, in the four kinds worth telling apart on a map. */
export type PlaceKind = "cafe" | "restaurant" | "bar" | "shop";

/**
 * One colour per kind of place, and a word for the legend.
 *
 * Deliberately none of them is the app's accent: the room's own pin is the
 * accent, and the whole point is that it can't be mistaken for a café. These
 * four read on Positron's near-white ground and on Dark Matter's near-black
 * one, so they don't change with the theme.
 */
export const PLACES: Record<PlaceKind, { color: string; label: string }> = {
  cafe: { color: "#d98324", label: "Cafés" },
  restaurant: { color: "#c2453d", label: "Restaurants" },
  bar: { color: "#7c5cbf", label: "Bars" },
  shop: { color: "#2f6fb5", label: "Shops" },
};

/**
 * The rooms *other* than the one you're looking at, on a single room's map.
 *
 * Red, so it reads as "not this one" at a glance, and deliberately not the
 * restaurant red above: these are teardrops rather than dots, and a step more
 * saturated, so a street of restaurants can't be mistaken for a street of
 * rooms going spare. Like the place colours it doesn't change with the theme —
 * it carries on both Positron's near-white ground and Dark Matter's near-black.
 */
export const NEARBY_ROOM_COLOR = "#dc2333";

export const MAX_ZOOM = 18;

/** Close enough to see the street the room is on, and what's on it. */
export const ROOM_ZOOM = 16;

/** The whole country fits at this zoom on a phone. */
export const COUNTRY_ZOOM = 7;

/** Reads the theme the app is actually in (see `[data-theme]` in globals.css). */
export function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "dark" || explicit === "light") return explicit;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

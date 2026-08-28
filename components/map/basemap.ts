/**
 * Basemap styles for the mapcn map component (`components/ui/map.tsx`).
 *
 * MapLibre draws vector tiles, so light and dark are two real styles rather
 * than one set of tiles under a CSS filter — labels stay readable and water
 * stays blue in both. These are mapcn's own defaults: CARTO's Positron and
 * Dark Matter GL styles, free and keyless (verified 2026-08-28: style, vector
 * tiles and the Open Sans glyphs the cluster labels need all serve 200s
 * without an account). CARTO's licence covers non-commercial use, which a
 * university project is.
 *
 * (Not to be confused with CARTO's *raster* tiles, which this app used until
 * 2026-08-27 and which now stamp "API KEY REQUIRED" across every image.)
 */
export const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

/**
 * MapLibre paints its own layers, so the pins can't be styled in CSS: these
 * are the palette values from globals.css, written out for the GL renderer.
 * `tests/map-colors.test.ts` fails if they drift from the stylesheet.
 *
 * `shades` runs small → large clusters; `on` is the count printed inside one,
 * and `ring` the outline drawn around it — the page's own ground colour, so a
 * pin reads as sitting on the app rather than on the tiles.
 */
export const MAP_COLORS = {
  light: {
    accent: "#2e7d5e",
    shades: ["#2e7d5e", "#256349", "#1a4635"] as [string, string, string],
    on: "#faf7f2",
    ring: "#faf7f2",
  },
  dark: {
    accent: "#c9a468",
    shades: ["#c9a468", "#b08c4f", "#96733a"] as [string, string, string],
    on: "#191613",
    ring: "#191613",
  },
} as const;

export const MAX_ZOOM = 18;

/** Close enough to read street names, wide enough to show the surroundings. */
export const ROOM_ZOOM = 15;

/** The whole country fits at this zoom on a phone. */
export const COUNTRY_ZOOM = 7;

/** Reads the theme the app is actually in (see `[data-theme]` in globals.css). */
export function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "dark" || explicit === "light") return explicit;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

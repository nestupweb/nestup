/**
 * Basemap tiles. CARTO's free "no labels + labels" pair renders a quiet map
 * that carries the app's own colours rather than fighting them, and ships a
 * light and a dark variant so the map follows the theme toggle.
 *
 * Free, no key, no account. Attribution is required and is rendered by
 * Leaflet's own control — see `ATTRIBUTION`.
 */
export const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
} as const;

export const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

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

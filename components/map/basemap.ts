/**
 * Basemap tiles: OpenStreetMap's own raster tiles — free, no API key, no
 * account, and the best street-level detail in Israel of the keyless options.
 *
 * (CARTO's basemaps were the first choice and were dropped on 2026-08-27: they
 * now stamp "API KEY REQUIRED" across every tile served without a key.)
 *
 * There is no keyless dark raster basemap, so the dark theme reuses the same
 * tiles under a CSS inversion — see `.leaflet-tiles-dark` in globals.css.
 * Attribution is required and Leaflet's own control renders it.
 *
 * If this app ever takes real traffic, OSM's tile policy asks apps to move to a
 * dedicated provider (MapTiler, Stadia — both have free tiers, both need a key):
 * https://operations.osmfoundation.org/policies/tiles/
 */
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Kept as a map for callers that switch on theme; both point at OSM. */
export const TILES = {
  light: TILE_URL,
  dark: TILE_URL,
} as const;

/** Applied to the dark tile layer to turn the light basemap into a dark one. */
export const DARK_TILE_CLASS = "leaflet-tiles-dark";

export const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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

import "server-only";
import { CITY_CENTRES } from "@/lib/city-centres";
import { distanceM, type LatLng } from "@/lib/geo";
import type { CoordsSource } from "@/lib/types";

/**
 * Address → coordinates, through Nominatim (OpenStreetMap). Free, no API key,
 * no account: https://operations.osmfoundation.org/policies/nominatim/ asks
 * for a real User-Agent and at most one request per second, which a listing
 * save comfortably respects — this runs once when a room is saved, never on
 * render.
 *
 * Never throws. A miss, a timeout or an outage returns the city centre with
 * `source: "city"`, so saving a listing always succeeds and the map simply
 * says the position is approximate.
 */

const UA = "NestUp/1.0 (student project; https://nestup-kappa.vercel.app)";
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 4000;

/** A result further than this from its city centre is a wrong match, not a room. */
const MAX_KM_FROM_CITY = 25_000;

export interface GeocodeResult {
  lat: number;
  lng: number;
  source: Extract<CoordsSource, "geocoded" | "city">;
}

export function cityCentre(city: string): LatLng | null {
  return CITY_CENTRES[city] ?? null;
}

/** Parse Nominatim's payload without trusting its shape. */
export function parseNominatim(payload: unknown): LatLng | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const first = payload[0] as { lat?: unknown; lon?: unknown };
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

/**
 * True when the hit is plausible for that city — guards against Nominatim
 * answering a street name from the other end of the country.
 */
export function nearCity(hit: LatLng, city: string): boolean {
  const centre = cityCentre(city);
  if (!centre) return true; // unknown city: nothing to compare against
  return distanceM(hit, centre) <= MAX_KM_FROM_CITY;
}

async function lookup(query: string): Promise<LatLng | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "il");
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return parseNominatim(await res.json());
}

/**
 * Look up "{street} {house_number}, {city}", then the street alone, then fall
 * back to the city centre. Returns `source: "city"` for the fallback so the UI
 * can say "approximate".
 */
export async function geocodeAddress(input: {
  street: string;
  house_number: string;
  city: string;
}): Promise<GeocodeResult | null> {
  const { street, house_number, city } = input;
  const queries = [
    `${street} ${house_number}, ${city}, Israel`.trim(),
    `${street}, ${city}, Israel`.trim(),
  ];
  for (const q of queries) {
    try {
      const hit = await lookup(q);
      if (hit && nearCity(hit, city)) return { ...hit, source: "geocoded" };
    } catch {
      break; // network/timeout — go straight to the city fallback
    }
  }
  const centre = cityCentre(city);
  return centre ? { ...centre, source: "city" } : null;
}

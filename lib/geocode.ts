import "server-only";
import { CITY_CENTRES } from "@/lib/city-centres";
import { distanceM, type LatLng } from "@/lib/geo";

/**
 * Address → coordinates, through Nominatim (OpenStreetMap). Free, no API key,
 * no account: https://operations.osmfoundation.org/policies/nominatim/ asks
 * for a real User-Agent and at most one request per second, which a listing
 * save comfortably respects — this runs once when a room is saved, never on
 * render.
 *
 * Never throws, and the answer is three-valued on purpose. It used to fall
 * back to the city centre, which put a pin on a street the room isn't on and
 * called it approximate; the user ruled that out on 2026-08-28. Now:
 *
 *   found        — the address is real, and this is where it is
 *   missing      — we asked, and there is no such address: the owner is asked
 *                  to drop the pin themselves
 *   unavailable  — nobody answered. Not the owner's fault, so the listing
 *                  saves with no coordinates and no complaint
 */

const UA = "NestUp/1.0 (student project; https://nestup-kappa.vercel.app)";
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 4000;

/** A result further than this from its city centre is a wrong match, not a room. */
const MAX_KM_FROM_CITY = 25_000;

export type GeocodeOutcome =
  | { status: "found"; lat: number; lng: number }
  | { status: "missing" }
  | { status: "unavailable" };

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
 * Look up "{street} {house_number}, {city}".
 *
 * Only the full address is asked for. The street on its own used to be a
 * second try, but its answer is a point somewhere along the street rather than
 * the room's address — precision we hadn't earned, and the reason rooms used
 * to be nudged a few metres apart to stop them stacking.
 */
export async function geocodeAddress(input: {
  street: string;
  house_number: string;
  city: string;
}): Promise<GeocodeOutcome> {
  const { street, house_number, city } = input;
  try {
    const hit = await lookup(`${street} ${house_number}, ${city}, Israel`.trim());
    if (hit && nearCity(hit, city)) return { status: "found", ...hit };
    // A hit at the wrong end of the country is the same as no hit: we still
    // don't know where this room is.
    return { status: "missing" };
  } catch {
    return { status: "unavailable" };
  }
}

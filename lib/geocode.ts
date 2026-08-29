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
 *   missing      — we asked, twice, and there is no such address
 *   unavailable  — nobody answered, twice. We know nothing about the address,
 *                  least of all that it is fake
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

/** Nominatim asks for at most one request a second; a retry waits that out. */
const RETRY_MS = 1100;

/**
 * One question to Nominatim, answered three ways.
 *
 * `answered: false` and "no such address" must not be confused: a 503 or a
 * timeout used to come back as `null`, indistinguishable from an empty result,
 * and the owner of a perfectly real address was told it did not exist.
 */
async function lookup(query: string): Promise<{ answered: boolean; hit: LatLng | null }> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "il");
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { answered: false, hit: null };
    return { answered: true, hit: parseNominatim(await res.json()) };
  } catch {
    return { answered: false, hit: null };
  }
}

/** Ask twice before giving up: one timeout shouldn't cost someone their listing. */
async function lookupTwice(query: string): Promise<{ answered: boolean; hit: LatLng | null }> {
  const first = await lookup(query);
  if (first.answered) return first;
  await new Promise((r) => setTimeout(r, RETRY_MS));
  return lookup(query);
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
  const { answered, hit } = await lookupTwice(`${street} ${house_number}, ${city}, Israel`.trim());
  // Nobody answered, twice. We know nothing about this address — least of all
  // that it is fake.
  if (!answered) return { status: "unavailable" };
  if (hit && nearCity(hit, city)) return { status: "found", ...hit };
  // A hit at the wrong end of the country is the same as no hit: we still
  // don't know where this room is.
  return { status: "missing" };
}

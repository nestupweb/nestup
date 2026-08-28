import { NextResponse } from "next/server";
import { placesQuery, readPlaces, type Place } from "@/lib/places";

/**
 * What's near a room: cafés, restaurants, bars and shops, from OpenStreetMap.
 *
 * Asked for only when someone actually opens a room's map, and answered from
 * the CDN for a day afterwards — the shops on a street don't change by the
 * hour, and Overpass is a volunteer service we should lean on lightly.
 *
 * **Never fails.** A mirror being busy is the normal case, not an exception:
 * every failure returns an empty list, so the map still opens with the room's
 * own pin on it and simply has nothing around it. The empty answer is cached
 * for a minute rather than a day, so the next visitor tries again.
 */

/** Overpass mirrors, in the order they're tried. */
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const UA = "NestUp/1.0 (student project; https://nestup-kappa.vercel.app)";

/** Long enough for a busy mirror to answer, short enough not to hang the panel. */
const TIMEOUT_MS = 9000;

/** A day for a real answer; a minute for an empty one, so an outage isn't sticky. */
const CACHE_HIT = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const CACHE_MISS = "public, max-age=60, s-maxage=60";

/**
 * Four decimals ≈ 11 m. Rounding the key means two people opening the same
 * room's map share one cached answer instead of asking Overpass twice.
 */
function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

async function ask(lat: number, lng: number): Promise<Place[] | null> {
  const query = placesQuery(lat, lng);
  for (const mirror of MIRRORS) {
    try {
      const res = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      return readPlaces(await res.json(), { lat, lng });
    } catch {
      /* busy, slow, or offline — try the next mirror */
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ places: [] }, { status: 400 });
  }

  const places = await ask(round(lat), round(lng));
  return NextResponse.json(
    { places: places ?? [] },
    { headers: { "Cache-Control": places ? CACHE_HIT : CACHE_MISS } }
  );
}

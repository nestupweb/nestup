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
 * own pin on it and simply has nothing around it.
 *
 * A failure is told apart from a genuinely empty street by `ok`, and is
 * **never cached** — an early version cached the empty answer for a minute and
 * the CDN kept serving it, so one unlucky moment left a room in the middle of
 * Tel Aviv looking like it had no cafés at all. The caller retries an `ok:
 * false` once (`components/map/RoomMapButton.tsx`).
 */

/**
 * Overpass mirrors, best first.
 *
 * More than one because a single mirror is not a dependency you can rely on:
 * the main instance rate-limits, and it cut us off completely while this was
 * being built. They all speak the same API over the same data.
 */
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const UA = "NestUp/1.0 (student project; https://nestup-kappa.vercel.app)";

/** The whole lookup, however many mirrors it takes. Someone is waiting. */
const DEADLINE_MS = 12_000;
/** How long a mirror gets to itself before the next one is also asked. */
const HEDGE_MS = 3500;

/** A day for a real answer. The shops on a street don't change by the hour. */
const CACHE_HIT = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
/** Nothing at all for a failure, so the next request actually asks again. */
const CACHE_MISS = "no-store";

/**
 * Four decimals ≈ 11 m. Rounding the key means two people opening the same
 * room's map share one cached answer instead of asking Overpass twice.
 */
function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Ask the mirrors, hedged: the next one joins in only if the one before it is
 * taking too long, and the first real answer wins.
 *
 * Trying them strictly in turn meant one wedged mirror spent the whole budget
 * before the working one was ever asked. Starting all three at once would be
 * quicker still, but these are volunteers' servers and two thirds of that load
 * would be wasted — so they overlap only when they have to.
 */
async function ask(lat: number, lng: number): Promise<Place[] | null> {
  const query = placesQuery(lat, lng);
  const deadline = AbortSignal.timeout(DEADLINE_MS);

  const attempt = async (mirror: string, waitFirst: number): Promise<Place[]> => {
    if (waitFirst) await sleep(waitFirst, deadline);
    const res = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: deadline,
    });
    if (!res.ok) throw new Error(`${mirror} ${res.status}`);
    return readPlaces(await res.json(), { lat, lng });
  };

  try {
    return await Promise.any(MIRRORS.map((mirror, i) => attempt(mirror, i * HEDGE_MS)));
  } catch {
    // Promise.any rejects only when every mirror did.
    return null;
  }
}

/** A delay that gives up with the rest of the lookup. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ places: [], ok: true }, { status: 400 });
  }

  const places = await ask(round(lat), round(lng));
  return NextResponse.json(
    { places: places ?? [], ok: places !== null },
    { headers: { "Cache-Control": places ? CACHE_HIT : CACHE_MISS } }
  );
}

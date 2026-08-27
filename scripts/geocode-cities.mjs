/**
 * One-off generator for `lib/city-centres.ts`.
 *
 * Looks every city in `lib/cities.ts` up in Nominatim (OpenStreetMap) once and
 * writes the centre points into a committed file, so the running app never
 * geocodes a city — it just reads the table. Re-run only when the city list
 * changes; the output is deterministic apart from OSM's own data drift.
 *
 * Nominatim asks for at most one request per second and a real User-Agent:
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * Run: node scripts/geocode-cities.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const UA = "NestUp/1.0 (student project; https://nestup-kappa.vercel.app)";
const ISRAEL = { minLat: 29.4, maxLat: 33.4, minLng: 34.2, maxLng: 35.95 };

/**
 * Manual points for places the lookup answers badly.
 *
 * All of these sit beyond the Green Line, which OSM files under a different
 * country code — with `countrycodes=il` the search either returns nothing or,
 * worse, a same-sounding place elsewhere (Ariel and Elkana both came back in
 * the Arava, Givat Ze'ev came back as Kiryat Shmona). Since the city list
 * includes them, their centres are pinned here by hand and checked by
 * `tests/unit/city-centres.test.ts`.
 */
const OVERRIDES = {
  "Alfei Menashe": { lat: 32.16560, lng: 34.99940 },
  Ariel: { lat: 32.10560, lng: 35.17390 },
  "Beit El": { lat: 31.94390, lng: 35.22250 },
  "Beitar Illit": { lat: 31.69610, lng: 35.11360 },
  Efrat: { lat: 31.65390, lng: 35.15190 },
  Elkana: { lat: 32.10970, lng: 34.99860 },
  "Givat Ze'ev": { lat: 31.86110, lng: 35.16830 },
  "Karnei Shomron": { lat: 32.17280, lng: 35.09580 },
  "Kiryat Arba": { lat: 31.52360, lng: 35.11190 },
  "Ma'ale Adumim": { lat: 31.77250, lng: 35.29810 },
  "Modi'in Illit": { lat: 31.93190, lng: 35.04170 },
  Oranit: { lat: 32.14440, lng: 34.99920 },
};

const inIsrael = (lat, lng) =>
  lat >= ISRAEL.minLat && lat <= ISRAEL.maxLat && lng >= ISRAEL.minLng && lng <= ISRAEL.maxLng;

async function lookup(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "il");
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const [hit] = await res.json();
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

const cities = (await readFile(new URL("../lib/cities.ts", import.meta.url), "utf8"))
  .split("export const CITIES = [")[1]
  .split("]")[0]
  .match(/"[^"]+"/g)
  .map((s) => s.slice(1, -1));

console.log(`${cities.length} cities to place`);

const out = {};
const failed = [];
for (const [i, city] of cities.entries()) {
  if (OVERRIDES[city]) {
    out[city] = OVERRIDES[city];
    continue;
  }
  let point = null;
  for (const q of [`${city}, Israel`, city]) {
    try {
      point = await lookup(q);
    } catch (e) {
      console.warn(`  ! ${city} (${q}): ${e.message}`);
    }
    await sleep(1100); // Nominatim: ≤ 1 request/second
    if (point && inIsrael(point.lat, point.lng)) break;
    point = null;
  }
  if (point) {
    out[city] = { lat: Number(point.lat.toFixed(5)), lng: Number(point.lng.toFixed(5)) };
    console.log(`${String(i + 1).padStart(3)}/${cities.length} ${city} → ${out[city].lat}, ${out[city].lng}`);
  } else {
    failed.push(city);
    console.log(`${String(i + 1).padStart(3)}/${cities.length} ${city} → NOT FOUND`);
  }
}

const body = Object.entries(out)
  .map(([city, p]) => `  ${JSON.stringify(city)}: { lat: ${p.lat}, lng: ${p.lng} },`)
  .join("\n");

await writeFile(
  new URL("../lib/city-centres.ts", import.meta.url),
  `import type { LatLng } from "@/lib/geo";

/**
 * Centre point of every city in \`lib/cities.ts\`, looked up once from
 * OpenStreetMap by \`scripts/geocode-cities.mjs\` and committed so the running
 * app never geocodes a city name. Used as the fallback position when a street
 * address can't be found, and as the anchor for demo-room scatter.
 *
 * Generated — edit \`scripts/geocode-cities.mjs\` (or its OVERRIDES) and re-run
 * rather than hand-editing entries.
 */
export const CITY_CENTRES: Record<string, LatLng> = {
${body}
};

/** Roughly the middle of the country — the map's home position. */
export const ISRAEL_CENTRE: LatLng = { lat: 31.7, lng: 35.0 };
`,
  "utf8"
);

console.log(`\nwrote lib/city-centres.ts with ${Object.keys(out).length} cities`);
if (failed.length) console.log(`missing (${failed.length}): ${failed.join(", ")}`);

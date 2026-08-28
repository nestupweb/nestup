/**
 * Puts every listing on its actual address.
 *
 * The demo rooms were deliberately never geocoded: their house numbers are
 * generated, so a lookup drops a pin on a real building. On 2026-08-28 the
 * user overruled that for the demo ("pin the accurate place — it's just a
 * demo school app"), so this walks every room and asks Nominatim where its
 * address is, instead of scattering it around the city centre.
 *
 * Three attempts per room, in order:
 *   1. the full address        "Yitzhak Rabin 12, Bat Yam, Israel"  → geocoded
 *   2. the street alone        "Yitzhak Rabin, Bat Yam, Israel"     → geocoded
 *      (cached per street+city, and nudged a few metres per listing so two
 *      rooms on one street don't land on the exact same pixel — identical
 *      points make a cluster that can never be split by zooming)
 *   3. the city centre, scattered, as before                        → city
 *
 * Asks **Photon** (photon.komoot.io) first and falls back to **Nominatim**,
 * both OpenStreetMap, because neither alone finishes the job:
 *   · Nominatim's policy is one request a second and no parallel requests,
 *     which puts ~800 rooms an hour and a half away — and asking faster
 *     doesn't fail loudly, the extra requests just come back empty and every
 *     room quietly lands on its city centre.
 *   · Photon has no such limit and answers in about a second, but its free
 *     instance stops answering after a few hundred requests in a row.
 * So Photon runs on a fast metronome, Nominatim strictly one at a time with a
 * 1.2s gap, and a room only reaches Nominatim when Photon has nothing. The
 * script is resumable, so a run that gets throttled can simply be run again.
 * `lib/geocode.ts` still uses Nominatim for the one lookup a real listing does
 * when it is saved.
 *
 * Idempotent and resumable: pass --all to redo rooms already geocoded.
 *
 * Run: npm run geocode:listings
 */
import { createClient } from "@supabase/supabase-js";
import { setTimeout as sleep } from "node:timers/promises";
import { CITY_CENTRES } from "../lib/city-centres.ts";
import { distanceM, scatter } from "../lib/geo.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing env — run via `npm run geocode:listings` so .env.local is loaded.");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const UA = "NestUp/1.0 (student project; https://nestup-kappa.vercel.app)";
/** Fair use of a free service: four requests a second, for a few minutes. */
const GAP_MS = 250;
/** Nominatim's published limit, with a margin. */
const NOMINATIM_GAP_MS = 1200;
/** How many replies we're willing to be waiting on at any moment. */
const IN_FLIGHT = 4;
/** Half a degree either way — a generous city, far short of the next one. */
const BOX_DEG = 0.35;
/** A hit further than this from its city centre is a wrong match, not a room. */
const MAX_M_FROM_CITY = 25_000;
/** How far apart two rooms on the same street are drawn. */
const SAME_STREET_M = 30;
/** How far a room with no findable address may sit from its city centre. */
const CITY_SCATTER_M = 2200;

const redo = process.argv.includes("--all");

/**
 * The metronome: every call waits for its own slot before firing, so the
 * *rate* stays inside a service's policy however slow the replies are.
 */
function metronome(gapMs, serial = false) {
  let nextSlot = 0;
  let tail = Promise.resolve();
  return (run) => {
    const start = async () => {
      const now = Date.now();
      const at = Math.max(now, nextSlot);
      nextSlot = at + gapMs;
      if (at > now) await sleep(at - now);
      return run();
    };
    if (!serial) return start();
    // Nominatim asks for no parallel requests at all, so its calls queue
    // behind each other rather than merely spacing their starts.
    const queued = tail.then(start, start);
    tail = queued.then(
      () => undefined,
      () => undefined
    );
    return queued;
  };
}

const paced = metronome(GAP_MS);
const pacedNominatim = metronome(NOMINATIM_GAP_MS, true);

function box(centre) {
  return [centre.lng - BOX_DEG, centre.lat - BOX_DEG, centre.lng + BOX_DEG, centre.lat + BOX_DEG];
}

function round(point) {
  return { lat: Math.round(point.lat * 1e6) / 1e6, lng: Math.round(point.lng * 1e6) / 1e6 };
}

async function askPhoton(query, city) {
  const u = new URL("https://photon.komoot.io/api/");
  u.searchParams.set("q", query);
  u.searchParams.set("limit", "1");
  u.searchParams.set("lang", "en");
  const centre = CITY_CENTRES[city];
  if (centre) {
    // Bias *and* bound: the bias picks the nearest match, the box makes a
    // match in another city impossible.
    u.searchParams.set("lat", String(centre.lat));
    u.searchParams.set("lon", String(centre.lng));
    u.searchParams.set("bbox", box(centre).join(","));
  }
  try {
    const res = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = await res.json();
    const [lng, lat] = body?.features?.[0]?.geometry?.coordinates ?? [];
    return Number.isFinite(lat) && Number.isFinite(lng) ? round({ lat, lng }) : null;
  } catch {
    return null;
  }
}

async function askNominatim(query, city) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", `${query}, Israel`);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "il");
  const centre = CITY_CENTRES[city];
  if (centre) u.searchParams.set("viewbox", box(centre).join(","));
  try {
    const res = await fetch(u, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const [hit] = await res.json();
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? round({ lat, lng }) : null;
  } catch {
    return null;
  }
}

/** Photon if it will answer, Nominatim if it won't. */
async function lookup(query, city) {
  const quick = await paced(() => askPhoton(query, city));
  if (quick) return quick;
  return pacedNominatim(() => askNominatim(query, city));
}

/** Rejects a hit that landed in a different part of the country. */
function plausible(hit, city) {
  const centre = CITY_CENTRES[city];
  if (!centre) return true;
  return distanceM(hit, centre) <= MAX_M_FROM_CITY;
}

let query = admin
  .from("listings")
  .select("id, city, address, street, house_number, coords_source")
  .neq("coords_source", "owner");
if (!redo) query = query.neq("coords_source", "geocoded");
const { data: rows, error } = await query;
if (error) throw new Error(error.message);

console.log(`${rows.length} room(s) to place — about ${Math.ceil((rows.length * 1.6 * GAP_MS) / 60000)} min`);

// A street is looked up once, not once per room on it. The promise is cached,
// not the result, so rooms running side by side share the one request.
const streetCache = new Map();
const tally = { address: 0, street: 0, city: 0, skipped: 0 };
let done = 0;

function onStreet(street, city) {
  const key = `${street}|${city}`;
  if (!streetCache.has(key)) {
    streetCache.set(
      key,
      lookup(`${street}, ${city}`, city).then((hit) => (hit && plausible(hit, city) ? hit : null))
    );
  }
  return streetCache.get(key);
}

async function place(row) {
  // The seed writes "Yitzhak Rabin 12" into `address`; the listing form writes
  // the same thing split across `street` + `house_number`. Accept either.
  const street = (row.street || row.address?.replace(/\s+\d+\s*$/, "") || "").trim();
  const houseNumber = (row.house_number || row.address?.match(/(\d+)\s*$/)?.[1] || "").trim();
  const city = row.city;

  if (street && houseNumber) {
    const hit = await lookup(`${street} ${houseNumber}, ${city}`, city);
    if (hit && plausible(hit, city)) {
      tally.address++;
      return { point: hit, source: "geocoded" };
    }
  }

  if (street) {
    const hit = await onStreet(street, city);
    if (hit) {
      tally.street++;
      // Nudged a few metres per listing: two rooms on one street sharing a
      // point make a cluster that no amount of zooming can split.
      return { point: scatter(hit, row.id, SAME_STREET_M), source: "geocoded" };
    }
  }

  const centre = CITY_CENTRES[city];
  if (!centre) return null;
  tally.city++;
  return { point: scatter(centre, row.id, CITY_SCATTER_M), source: "city" };
}

/**
 * Writing the row back, with a deadline.
 *
 * Without one a single wedged keep-alive connection stops the whole run: the
 * worker waits on a reply that never comes, and because the other workers hit
 * the same pool they stop too. The first version of this script died that way
 * twice, silently — process alive, nothing moving.
 */
async function save(row, placed) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error: upErr } = await admin
      .from("listings")
      .update({ lat: placed.point.lat, lng: placed.point.lng, coords_source: placed.source })
      .eq("id", row.id)
      .abortSignal(AbortSignal.timeout(8000));
    if (!upErr) return;
    if (attempt === 3) throw new Error(`update ${row.id}: ${upErr.message}`);
    await sleep(400 * attempt);
  }
}

const queue = [...rows];
async function worker() {
  for (let row = queue.shift(); row; row = queue.shift()) {
    const placed = await place(row);
    if (!placed) {
      tally.skipped++;
      console.log(`  ? ${row.city} — no centre for this city, left alone`);
      continue;
    }
    await save(row, placed);

    if (++done % 25 === 0) {
      console.log(`  ${done}/${rows.length} · address ${tally.address} · street ${tally.street} · city ${tally.city}`);
    }
  }
}

await Promise.all(Array.from({ length: IN_FLIGHT }, worker));

console.log(
  `done — ${tally.address} on the house number, ${tally.street} on the street, ${tally.city} on the city centre, ${tally.skipped} left alone`
);

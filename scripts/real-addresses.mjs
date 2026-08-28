/**
 * Puts every demo room on a real street, at a real point.
 *
 * The seed invented street names ("HaTamar 37, Jaljulia", "Eshkol 78,
 * Katzrin"). Most don't exist, so they never geocoded, and the old pipeline
 * dropped those rooms somewhere inside a 2.2 km circle around the city centre
 * — a made-up position for a made-up address. The user ruled that out on
 * 2026-08-28: every pin has to be a real place, and no coordinate may come
 * from a random offset.
 *
 * So this replaces the address instead of faking the position. For each town
 * it asks OpenStreetMap (Overpass) which streets are actually there, and hands
 * each unplaceable room one of them:
 *
 *   1. a real addressed building — street + house number, pinned on the
 *      building itself. Best case, and what most rooms in the bigger towns get.
 *   2. otherwise a real street, pinned on one of the street's own mapped
 *      vertices, with **no** house number: we know the street, so that is all
 *      the address claims.
 *
 * Rooms that already geocode from their own address keep it; they are re-asked
 * once and re-saved on the answer, which also drops the 30 m same-street nudge
 * the old script used to add.
 *
 * Nothing else about a listing is touched — city, rent, photos, owner and
 * description are left exactly as they were.
 *
 * Overpass answers are cached in the OS temp dir, so a second run costs
 * nothing and only the rooms still needing work are looked at.
 *
 * Run: npm run addresses:real
 *   --dry          work it all out and print it, write nothing
 *   --skip-check   trust the rooms that already geocoded and only place the rest
 */
import { createClient } from "@supabase/supabase-js";
import { setTimeout as sleep } from "node:timers/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CITY_CENTRES } from "../lib/city-centres.ts";
import { distanceM, hashUnit } from "../lib/geo.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing env — run via `npm run addresses:real` so .env.local is loaded.");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const dry = process.argv.includes("--dry");
const skipCheck = process.argv.includes("--skip-check");
const UA = "NestUp/1.0 (student project; https://nestup-kappa.vercel.app)";

/** Overpass mirrors, tried in turn: the main one is often busy (429/504). */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];
/** How far out of the centre a town's streets are collected. */
const TOWN_RADIUS_M = 3000;
/** A hit further than this from its city centre is a wrong match, not a room. */
const MAX_M_FROM_CITY = 25_000;
/** Half a degree either way — a generous city, far short of the next one. */
const BOX_DEG = 0.35;
/** Where Overpass answers are kept between runs. Outside the repo on purpose. */
const CACHE = join(tmpdir(), "nestup-overpass");

mkdirSync(CACHE, { recursive: true });

/* ------------------------------------------------------------------ *
 * OpenStreetMap: what is actually in this town
 * ------------------------------------------------------------------ */

/** The ways people live on. Motorways and tracks are not addresses. */
const STREET_TYPES = "residential|living_street|unclassified|tertiary|secondary|primary|pedestrian";

function query(centre) {
  return [
    "[out:json][timeout:90];",
    `way(around:${TOWN_RADIUS_M},${centre.lat},${centre.lng})[highway~"^(${STREET_TYPES})$"][name]->.streets;`,
    `nwr(around:${TOWN_RADIUS_M},${centre.lat},${centre.lng})["addr:housenumber"]["addr:street"]->.doors;`,
    ".streets out tags geom 300;",
    ".doors out tags center 600;",
  ].join("\n");
}

async function overpass(q) {
  for (let round = 0; round < 3; round++) {
    for (const endpoint of OVERPASS) {
      try {
        const res = await fetch(`${endpoint}?data=${encodeURIComponent(q)}`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: AbortSignal.timeout(120_000),
        });
        if (res.ok) return await res.json();
        // 429 = too many requests, 504 = the mirror is busy with someone
        // else's query. Both are worth waiting out rather than giving up on.
        if (res.status !== 429 && res.status !== 504) return null;
      } catch {
        /* timeout or socket — try the next mirror */
      }
      await sleep(2000);
    }
    await sleep(5000 * (round + 1));
  }
  return null;
}

/** A house number we can print: "12", "12A". Not "12-14" or a Hebrew word. */
function usableNumber(value) {
  return typeof value === "string" && /^\d{1,4}[A-Za-z]?$/.test(value.trim());
}

/** True for a name we can print in an English-language app. */
function latin(value) {
  return typeof value === "string" && /^[\x20-\x7E]+$/.test(value);
}

/**
 * Everything in one town worth pinning a room on, in English.
 *
 * Streets are collected with their Hebrew name as well, because that is the
 * name a building's `addr:street` is written in — matching the two is the only
 * way to print an addressed building in English.
 */
async function townPlaces(city, centre) {
  const cached = join(CACHE, `${city.replace(/[^a-z0-9]+/gi, "_")}.json`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, "utf8"));

  const body = await overpass(query(centre));
  if (!body) return null;

  const streets = [];
  const englishByLocal = new Map();
  const doors = [];

  for (const element of body.elements ?? []) {
    const tags = element.tags ?? {};

    if (element.type === "way" && tags.highway && Array.isArray(element.geometry)) {
      const english = tags["name:en"] ?? (latin(tags.name) ? tags.name : null);
      if (!english || !tags.name) continue;
      englishByLocal.set(tags.name, english);
      const points = element.geometry.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
      if (points.length) streets.push({ name: english, points: points.map((p) => [p.lat, p.lon]) });
      continue;
    }

    const point = element.center ?? element;
    if (!usableNumber(tags["addr:housenumber"])) continue;
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    doors.push({
      street: tags["addr:street"],
      number: tags["addr:housenumber"].trim(),
      lat: point.lat,
      lng: point.lon,
    });
  }

  // A building is only usable once its street can be said in English.
  const addressed = doors
    .map((d) => ({ ...d, name: englishByLocal.get(d.street) ?? (latin(d.street) ? d.street : null) }))
    .filter((d) => d.name);

  const places = { streets, addressed };
  writeFileSync(cached, JSON.stringify(places));
  return places;
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * The addresses a town can offer, best first.
 *
 * Addressed buildings come first — they carry a house number and sit on the
 * building itself. After them, three points along each street: a room pinned
 * on a mapped vertex of the street it names is exactly where it says it is, it
 * just doesn't claim a door number.
 */
function candidates(places) {
  const fromDoors = places.addressed.map((d) => ({
    street: d.name,
    number: d.number,
    lat: round(d.lat),
    lng: round(d.lng),
  }));

  const fromStreets = [];
  for (const street of places.streets) {
    const n = street.points.length;
    for (const fraction of [0.5, 0.25, 0.75]) {
      const [lat, lng] = street.points[Math.min(n - 1, Math.floor(n * fraction))];
      fromStreets.push({ street: street.name, number: "", lat: round(lat), lng: round(lng) });
    }
  }

  // Ordered by a hash rather than at random, so a second run over the same
  // town produces the same addresses and nothing appears to move.
  const spread = (list) =>
    list
      .map((c) => ({ c, k: hashUnit(`${c.street}|${c.number}|${c.lat}|${c.lng}`) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.c);

  const seen = new Set();
  return [...spread(fromDoors), ...spread(fromStreets)].filter((c) => {
    const key = `${c.lat},${c.lng}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Geocoding, for the rooms whose address is already real
 * ------------------------------------------------------------------ */

/** Nominatim's published limit, with a margin. */
const NOMINATIM_GAP_MS = 1200;
/** Photon publishes no limit; four a second is polite. */
const PHOTON_GAP_MS = 250;
/** Consecutive Photon failures before the run gives up on it. */
const PHOTON_STRIKES = 5;

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

const pacedPhoton = metronome(PHOTON_GAP_MS);
const pacedNominatim = metronome(NOMINATIM_GAP_MS, true);

function box(centre) {
  return [centre.lng - BOX_DEG, centre.lat - BOX_DEG, centre.lng + BOX_DEG, centre.lat + BOX_DEG];
}

/**
 * Answers are three-valued on purpose: a hit and "no such address" are both
 * real answers, but a network failure is neither. Reading an outage as "this
 * address doesn't exist" would rewrite a perfectly good address.
 */
async function askPhoton(q, city) {
  const u = new URL("https://photon.komoot.io/api/");
  u.searchParams.set("q", q);
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
    if (!res.ok) return { ok: false };
    const body = await res.json();
    const [lng, lat] = body?.features?.[0]?.geometry?.coordinates ?? [];
    const found = Number.isFinite(lat) && Number.isFinite(lng) ? { lat: round(lat), lng: round(lng) } : null;
    return { ok: true, found };
  } catch {
    return { ok: false };
  }
}

async function askNominatim(q, city) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", `${q}, Israel`);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "il");
  const centre = CITY_CENTRES[city];
  if (centre) u.searchParams.set("viewbox", box(centre).join(","));
  try {
    const res = await fetch(u, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false };
    const [hit] = await res.json();
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    const found = Number.isFinite(lat) && Number.isFinite(lng) ? { lat: round(lat), lng: round(lng) } : null;
    return { ok: true, found };
  } catch {
    return { ok: false };
  }
}

let photonStrikes = 0;

/**
 * Photon while it will answer, Nominatim when it won't.
 * `null` = no such address. `undefined` = nobody would answer.
 */
async function geocode(q, city) {
  if (photonStrikes < PHOTON_STRIKES) {
    const quick = await pacedPhoton(() => askPhoton(q, city));
    if (quick.ok && quick.found) {
      photonStrikes = 0;
      return quick.found;
    }
    if (!quick.ok && ++photonStrikes === PHOTON_STRIKES) {
      console.log("  photon isn't answering — the rest of this run goes to Nominatim");
    }
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const slow = await pacedNominatim(() => askNominatim(q, city));
    if (slow.ok) return slow.found;
    await sleep(1500 * attempt);
  }
  return undefined;
}

function plausible(hit, city) {
  const centre = CITY_CENTRES[city];
  if (!centre) return true;
  return distanceM(hit, centre) <= MAX_M_FROM_CITY;
}

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */

/**
 * Writing the row back, with a deadline.
 *
 * Without one a single wedged keep-alive connection stops the whole run: the
 * process stays alive and nothing moves. An earlier script died that way twice.
 */
async function save(id, patch) {
  if (dry) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error: upErr } = await admin
      .from("listings")
      .update(patch)
      .eq("id", id)
      .abortSignal(AbortSignal.timeout(8000));
    if (!upErr) return;
    if (attempt === 3) throw new Error(`update ${id}: ${upErr.message}`);
    await sleep(400 * attempt);
  }
}

const { data: rows, error } = await admin
  .from("listings")
  .select("id, city, address, street, house_number, coords_source, lat, lng")
  .neq("coords_source", "owner")
  .order("id");
if (error) throw new Error(error.message);

console.log(`${rows.length} room(s) to check\n`);

/** Split the room's stored address, however the row happens to hold it. */
function parts(row) {
  const street = (row.street || row.address?.replace(/\s+\d+[A-Za-z]?\s*$/, "") || "").trim();
  const number = (row.house_number || row.address?.match(/(\d+[A-Za-z]?)\s*$/)?.[1] || "").trim();
  return { street, number };
}

// ── Pass 1: a room whose own address is real keeps it, re-pinned exactly. ──
const needsAddress = [];
const tally = { kept: 0, doors: 0, streets: 0, stuck: 0 };
let checked = 0;

for (const row of rows) {
  const { street, number } = parts(row);
  if (row.coords_source !== "geocoded" || !street) {
    needsAddress.push(row);
    continue;
  }
  if (skipCheck) continue; // already on a real address, and we were told to trust it
  const hit = await geocode(`${street}${number ? ` ${number}` : ""}, ${row.city}`, row.city);
  if (hit === undefined) {
    tally.stuck++; // nobody answered — better to leave it than to guess
  } else if (hit && plausible(hit, row.city)) {
    await save(row.id, { lat: hit.lat, lng: hit.lng, coords_source: "geocoded" });
    tally.kept++;
  } else {
    needsAddress.push(row); // the address doesn't exist: give it a real one
  }
  if (++checked % 50 === 0) {
    console.log(`  checked ${checked} · kept ${tally.kept} · to replace ${needsAddress.length}`);
  }
}

console.log(`\n${tally.kept} room(s) kept their address. ${needsAddress.length} need a real one.\n`);

// ── Pass 2: hand out real addresses, town by town. ──
const byCity = new Map();
for (const row of needsAddress) {
  if (!byCity.has(row.city)) byCity.set(row.city, []);
  byCity.get(row.city).push(row);
}

const towns = [...byCity.keys()].sort();
let town = 0;
for (const city of towns) {
  const centre = CITY_CENTRES[city];
  const roomsHere = byCity.get(city);
  town++;

  if (!centre) {
    console.log(`  ${city}: no centre on file — ${roomsHere.length} room(s) left alone`);
    tally.stuck += roomsHere.length;
    continue;
  }

  const places = await townPlaces(city, centre);
  if (!places) {
    console.log(`  ${city}: OpenStreetMap wouldn't answer — ${roomsHere.length} room(s) left alone`);
    tally.stuck += roomsHere.length;
    continue;
  }

  const pool = candidates(places);
  if (pool.length === 0) {
    console.log(`  ${city}: no named streets found — ${roomsHere.length} room(s) left alone`);
    tally.stuck += roomsHere.length;
    continue;
  }

  for (const [index, row] of roomsHere.entries()) {
    const pick = pool[index % pool.length];
    await save(row.id, {
      address: pick.number ? `${pick.street} ${pick.number}` : pick.street,
      street: pick.street,
      house_number: pick.number,
      lat: pick.lat,
      lng: pick.lng,
      coords_source: "geocoded",
    });
    if (pick.number) tally.doors++;
    else tally.streets++;
    if (index === 0) {
      console.log(`      e.g. ${row.address || "(none)"} → ${pick.number ? `${pick.street} ${pick.number}` : pick.street}`);
    }
  }

  const doors = pool.filter((c) => c.number).length;
  console.log(
    `  ${String(town).padStart(3)}/${towns.length} ${city}: ${roomsHere.length} placed ` +
      `(${doors} building(s) and ${places.streets.length} street(s) known here)`
  );
}

console.log(
  `\ndone — ${tally.kept} kept, ${tally.doors} on a real building, ` +
    `${tally.streets} on a real street, ${tally.stuck} left alone`
);
if (dry) console.log("(--dry: nothing was written)");

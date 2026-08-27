/**
 * Gives every listing that has no coordinates a point on the map.
 *
 * Demo rooms (seed.user*@nestup.dev) are deliberately NOT geocoded: their house
 * numbers are generated, so looking them up would drop a pin on a real
 * building that has nothing to do with the listing. They get a repeatable
 * scatter around their city centre instead — believable at neighbourhood zoom,
 * honest about being demo data. Their `coords_source` stays 'city'.
 *
 * Rooms posted by real people are geocoded from the address, one request per
 * second, as Nominatim asks.
 *
 * Idempotent: a listing that already has a point is left alone.
 *
 * Run: npm run backfill:coords
 */
import { createClient } from "@supabase/supabase-js";
import { setTimeout as sleep } from "node:timers/promises";
import { CITY_CENTRES } from "../lib/city-centres.ts";
import { scatter } from "../lib/geo.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing env — run via `npm run backfill:coords` so .env.local is loaded.");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const UA = "NestUp/1.0 (student project; https://nestup-kappa.vercel.app)";
/** How far a demo room may sit from its city centre. */
const SCATTER_M = 2200;

async function geocode(street, houseNumber, city) {
  const q = `${street} ${houseNumber}, ${city}, Israel`;
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", q);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "il");
  try {
    const res = await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
    if (!res.ok) return null;
    const [hit] = await res.json();
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

const { data: rows, error } = await admin
  .from("listings")
  .select("id, owner_id, city, street, house_number, lat")
  .is("lat", null);
if (error) throw new Error(error.message);

const { data: owners } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const seedIds = new Set((owners?.users ?? []).filter((u) => u.email?.endsWith("@nestup.dev")).map((u) => u.id));

console.log(`${rows.length} listing(s) without a point`);

let placed = 0;
let missing = 0;
for (const row of rows) {
  const centre = CITY_CENTRES[row.city];
  let point = null;
  let source = "city";

  if (seedIds.has(row.owner_id)) {
    if (!centre) {
      missing++;
      console.log(`  ? ${row.city} — no centre for this city, skipped`);
      continue;
    }
    point = scatter(centre, row.id, SCATTER_M); // demo room: scattered, never geocoded
  } else {
    const hit = await geocode(row.street, row.house_number, row.city);
    await sleep(1100);
    if (hit) {
      point = hit;
      source = "geocoded";
    } else if (centre) {
      point = centre;
    }
  }

  if (!point) {
    missing++;
    continue;
  }
  const { error: upErr } = await admin
    .from("listings")
    .update({ lat: point.lat, lng: point.lng, coords_source: source })
    .eq("id", row.id);
  if (upErr) throw new Error(`update ${row.id}: ${upErr.message}`);
  placed++;
}

console.log(`placed ${placed}, skipped ${missing}`);

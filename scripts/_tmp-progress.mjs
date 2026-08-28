import { createClient } from "@supabase/supabase-js";
import { CITY_CENTRES } from "../lib/city-centres.ts";
import { distanceM } from "../lib/geo.ts";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await admin.from("listings").select("city, lat, lng, coords_source, house_number");
const by = {};
for (const r of data) by[r.coords_source] = (by[r.coords_source] || 0) + 1;
const placed = data.filter(r => r.lat != null && r.coords_source === "geocoded");
const tally = new Map();
for (const r of placed) { const k = `${r.lat},${r.lng}`; tally.set(k, (tally.get(k) || 0) + 1); }
const shared = [...tally.values()].filter(n => n > 1);
const far = placed.filter(r => { const c = CITY_CENTRES[r.city]; return c && distanceM({ lat: r.lat, lng: r.lng }, c) > 8000; });
console.log(new Date().toTimeString().slice(0, 8), JSON.stringify(by),
  "| shared points:", shared.length, "(", shared.reduce((s, n) => s + n, 0), "rooms )",
  "| far from city:", far.length,
  "| with number:", data.filter(r => r.house_number).length);

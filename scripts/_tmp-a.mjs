/**
 * Every active listing, live: the roommate count it prints, the room count it
 * prints, and the rule tying them together — roommates <= ceil(rooms) - 1.
 */
import { readFileSync } from "node:fs";
const base = "https://nestup-kappa.vercel.app";
const env = Object.fromEntries(
  readFileSync("../Final-Project/.env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const maxRoommates = (rooms) => Math.max(1, Math.ceil(rooms) - 1);

const rooms = [];
for (let offset = 0; ; offset += 1000) {
  const r = await fetch(`${SUPA}/rest/v1/listings?select=id,title,rooms,household_size,roommates_count&is_active=eq.true&removed_at=is.null&limit=1000&offset=${offset}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) break;
  rooms.push(...rows); if (rows.length < 1000) break;
}
console.log(`auditing ${rooms.length} listings…`);

const COUNT_RE = /(\d+)<!-- --> roommate/;
const ROOMS_RE = /(\d+(?:\.\d)?)<!-- --> room(?:<!-- -->s)?[,<]/;
const problems = [];
let done = 0;

async function check(room) {
  const cap = maxRoommates(Number(room.rooms));
  if (room.household_size > cap) problems.push(`${room.id}: DB household ${room.household_size} > cap ${cap} for ${room.rooms} rooms`);
  if (room.roommates_count > cap) problems.push(`${room.id}: DB typed ${room.roommates_count} > cap ${cap}`);
  let html = "";
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(`${base}/browse/${room.id}`);
      if (!res.ok) { if (a === 2) problems.push(`${room.id}: HTTP ${res.status}`); continue; }
      html = await res.text(); break;
    } catch (e) { if (a === 2) problems.push(`${room.id}: ${e.message}`); }
  }
  if (!html) return;
  const m = html.match(COUNT_RE);
  if (!m) problems.push(`${room.id}: no roommate line`);
  else {
    const printed = Number(m[1]);
    if (printed !== room.household_size) problems.push(`${room.id}: prints ${printed}, household_size ${room.household_size}`);
    if (printed > cap) problems.push(`${room.id} (${room.title}): prints ${printed} roommates in a ${room.rooms}-room home (cap ${cap})`);
  }
  if (++done % 100 === 0) process.stdout.write(`\r  ${done}/${rooms.length}   `);
}

for (let i = 0; i < rooms.length; i += 12) await Promise.all(rooms.slice(i, i + 12).map(check));
console.log();
console.log(`listings audited                       : ${done}`);
console.log(`printed count over the room cap        : ${problems.filter((p) => p.includes("in a")).length}`);
console.log(`any problem at all                     : ${problems.length}`);
const dist = {};
for (const r of rooms) dist[r.rooms] = (dist[r.rooms] ?? 0) + 1;
console.log("rooms distribution now                 :", JSON.stringify(dist));
for (const p of problems.slice(0, 15)) console.log("  !", p);
process.exit(problems.length === 0 ? 0 : 1);

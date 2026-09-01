/**
 * The claim itself, on every room: the number the page prints equals the number
 * of people it actually renders under "Who lives here".
 *
 * Signed in (residents are RLS-hidden otherwise), fetching the server HTML
 * through an authenticated request context — no rendering, so all 815 fit in
 * one run. Counts the `<name>'s profile` links, which the household list is the
 * only thing on the page to emit.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const base = "https://nestup-kappa.vercel.app";
const env = Object.fromEntries(
  readFileSync("../Final-Project/.env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const rooms = [];
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(
    `${SUPA}/rest/v1/listings?select=id,title,household_size,roommates_count&is_active=eq.true&removed_at=is.null&limit=1000&offset=${offset}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) break;
  rooms.push(...rows);
  if (rows.length < 1000) break;
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "seed.user1@nestup.dev");
await page.fill('input[name="password"]', "Demo1234!");
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }),
  page.click('button[type="submit"]'),
]);
await page.close();
console.log(`signed in — checking ${rooms.length} rooms…`);

const FACE_RE = /aria-label="[^"]*&#x27;s profile"|aria-label="[^"]*'s profile"/g;
const COUNT_RE = /(\d+)<!-- --> roommate/;
const problems = [];
let done = 0, ownRoom = 0;

async function check(room) {
  let html = "";
  for (let a = 0; a < 3; a++) {
    try {
      const res = await ctx.request.get(`${base}/browse/${room.id}`, { timeout: 60_000 });
      if (!res.ok()) { if (a === 2) problems.push(`${room.id}: HTTP ${res.status()}`); continue; }
      html = await res.text();
      break;
    } catch (e) { if (a === 2) problems.push(`${room.id}: ${e.message}`); }
  }
  if (!html) return;
  const faces = (html.match(FACE_RE) ?? []).length;
  const m = html.match(COUNT_RE);
  const printed = m ? Number(m[1]) : null;
  if (printed === null) { problems.push(`${room.id}: no roommate line`); return; }
  if (faces === 0) { ownRoom++; return; } // the seeker's own listing renders no household links
  if (faces !== printed) {
    problems.push(`${room.id} (${room.title}): prints ${printed} but renders ${faces} ${faces === 1 ? "person" : "people"}`);
  }
  if (printed !== room.household_size) {
    problems.push(`${room.id}: prints ${printed}, household_size ${room.household_size}`);
  }
  if (++done % 100 === 0) process.stdout.write(`\r  ${done}/${rooms.length}   `);
}

const CONCURRENCY = 8;
for (let i = 0; i < rooms.length; i += CONCURRENCY) {
  await Promise.all(rooms.slice(i, i + CONCURRENCY).map(check));
}
await browser.close();
console.log();
console.log(`rooms whose printed number was compared with the faces rendered: ${done}`);
console.log(`rooms skipped (no household list rendered)                     : ${ownRoom}`);
console.log(`mismatches                                                     : ${problems.length}`);
for (const p of problems.slice(0, 20)) console.log("  !", p);
process.exit(problems.length === 0 ? 0 : 1);

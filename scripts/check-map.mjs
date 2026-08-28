/**
 * Live check of the map work on production.
 *
 * Confirms, in a real browser: no map is drawn until an icon is pressed, the
 * basemap is CARTO served by us, its labels come back in English (not Hebrew),
 * the room's pin is distinct from the coloured place pins and from the red
 * pins of the rooms nearby, and the legend names what's on the map. Runs in
 * light and dark.
 */
import { chromium } from "playwright";
import { inflateSync } from "node:zlib";

const base = (process.argv[2] ?? "https://nestup-kappa.vercel.app").replace(/\/$/, "");
const failures = [];
const note = (ok, label, extra = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${extra ? " — " + extra : ""}`);
  if (!ok) failures.push(label);
};

/**
 * Pixels of one exact colour in a PNG buffer.
 *
 * Hand-rolled rather than pulling in a decoder: PNG's filters are a few lines,
 * and the check needs one colour counted, not an image library.
 */
function countPixels(png, [wantR, wantG, wantB]) {
  let at = 8;
  const chunks = [];
  let width = 0;
  let height = 0;
  let bpp = 0;
  while (at < png.length) {
    const size = png.readUInt32BE(at);
    const kind = png.toString("ascii", at + 4, at + 8);
    if (kind === "IHDR") {
      width = png.readUInt32BE(at + 8);
      height = png.readUInt32BE(at + 12);
      // Playwright hands back 8-bit RGB or RGBA depending on the page.
      if (png[at + 16] !== 8) return -1;
      bpp = png[at + 17] === 6 ? 4 : png[at + 17] === 2 ? 3 : 0;
      if (!bpp) return -1;
    }
    if (kind === "IDAT") chunks.push(png.subarray(at + 8, at + 8 + size));
    at += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * bpp;
  const line = Buffer.alloc(stride);
  const above = Buffer.alloc(stride);
  let found = 0;
  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++];
    raw.copy(line, 0, read, read + stride);
    read += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = above[i];
      const c = i >= bpp ? above[i - bpp] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i] + add) & 0xff;
    }
    for (let x = 0; x < stride; x += bpp) {
      if (
        Math.abs(line[x] - wantR) <= 6 &&
        Math.abs(line[x + 1] - wantG) <= 6 &&
        Math.abs(line[x + 2] - wantB) <= 6
      ) {
        found++;
      }
    }
    line.copy(above);
  }
  return found;
}

const browser = await chromium.launch();

async function run(theme) {
  const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const styleRequests = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/maplibre|cartocdn|openfreemap|tiles\./.test(u)) styleRequests.push(u);
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  console.log(`\n=== ${theme} ===`);

  // ---- Listings: icon present, no map until pressed ----
  await page.goto(`${base}/browse`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  note((await page.locator("canvas.maplibregl-canvas").count()) === 0, "listings draws no map on load");

  const listingsIcon = page.getByRole("button", { name: /open the map of every room/i });
  note((await listingsIcon.count()) === 1, "listings has the square map icon");
  await listingsIcon.click();
  await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 30000 });
  const subtitle = await page.locator('[role="dialog"] p').first().innerText();
  note(/\d+ rooms on the map/.test(subtitle), "all-rooms map opens with a count", subtitle.trim());
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `listings-map-${theme}.png` });

  // The pins thin out when they'd overlap, so zooming in has to reveal more.
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: /zoom in/i }).click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `listings-map-${theme}-zoomed.png` });

  await page.getByRole("button", { name: /close map/i }).click();

  // ---- A room page ----
  // Rooms that couldn't be placed exactly get no map at all, by design, so
  // walk the results until one that can be placed turns up.
  await page.goto(`${base}/browse`, { waitUntil: "domcontentloaded" });
  const hrefs = await page.locator('a[href^="/browse/"]').evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute("href")))].slice(0, 10)
  );

  let roomIcon = null;
  let skipped = 0;
  for (const href of hrefs) {
    await page.goto(`${base}${href}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    note((await page.locator("canvas.maplibregl-canvas").count()) === 0, `room page draws no map on load (${href})`);
    const icon = page.getByRole("button", { name: /open the map of/i });
    if ((await icon.count()) === 1) {
      roomIcon = icon;
      break;
    }
    skipped++;
  }
  note(Boolean(roomIcon), "a room page offers the map icon", `${skipped} room(s) before it had no location`);
  if (!roomIcon) {
    await context.close();
    return;
  }

  await roomIcon.click();
  await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 30000 });
  await page.waitForTimeout(6000); // tiles, then the places lookup

  // Room pin vs place pins
  const roomPins = await page.locator(".room-pin").count();
  const placePins = await page.locator(".maplibregl-marker").count();
  note(roomPins === 1, "exactly one room pin", `${roomPins} room / ${placePins} markers total`);
  note(placePins > 1, "places are drawn around the room", `${placePins - 1} place pin(s)`);

  const legend = await page.locator('[role="dialog"] ul li').allInnerTexts();
  note(legend[0]?.includes("This room"), "legend leads with the room", legend.join(" · "));
  note(/\d+ other rooms? nearby/.test(legend[1] ?? ""), "and the alternatives second", legend[1] ?? "none");

  // The alternatives are a GL layer, so they leave no DOM to count: what can be
  // checked from out here is that their red is actually being painted, and that
  // it isn't the restaurants' red wearing a disguise.
  const shot = await page.locator('[role="dialog"] .maplibregl-canvas').screenshot();
  const reds = countPixels(shot, [0xdc, 0x23, 0x33]);
  note(reds > 40, "nearby rooms are painted in their own red", `${reds} pixel(s)`);

  // Basemap: ours, CARTO underneath, nothing from the rejected provider
  const styleUrl = styleRequests.find((u) => /positron-en|dark-matter-en/.test(u));
  note(Boolean(styleUrl), "basemap style is our English CARTO file", styleUrl ?? "none seen");
  note(!styleRequests.some((u) => /openfreemap/.test(u)), "no OpenFreeMap request");
  note(styleRequests.some((u) => /cartocdn/.test(u)), "CARTO tiles/glyphs requested");

  // Hebrew would show up in the tooltip text of places; check the ones we drew.
  // (The basemap's own labels are painted into the canvas and can't be read
  //  from the DOM — the screenshot this leaves behind is how those get checked.)
  const tooltips = await page.locator(".maplibregl-marker").evaluateAll((els) =>
    els.map((e) => e.getAttribute("title") ?? e.textContent ?? "")
  );
  const hebrew = tooltips.filter((t) => /[֐-׿]/.test(t));
  note(hebrew.length === 0, "no Hebrew in our own pins", hebrew.slice(0, 3).join(", "));

  note(pageErrors.length === 0, "no page errors", pageErrors.slice(0, 2).join(" | "));

  await page.screenshot({ path: `map-${theme}.png` });
  await context.close();
}

await run("light");
await run("dark");
await browser.close();

console.log(`\n${failures.length === 0 ? "ALL GOOD" : `${failures.length} FAILURE(S): ${failures.join(", ")}`}`);
process.exit(failures.length ? 1 : 0);

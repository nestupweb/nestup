/**
 * Live check of the map work on production.
 *
 * Confirms, in a real browser: no map is drawn until an icon is pressed, the
 * basemap is CARTO served by us, its labels come back in English (not Hebrew),
 * the room's pin is distinct from the coloured place pins, and the legend
 * names what's on the map. Runs in light and dark.
 */
import { chromium } from "playwright";

const base = (process.argv[2] ?? "https://nestup-kappa.vercel.app").replace(/\/$/, "");
const failures = [];
const note = (ok, label, extra = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${extra ? " — " + extra : ""}`);
  if (!ok) failures.push(label);
};

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
  await page.waitForTimeout(3000);
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

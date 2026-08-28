import { chromium } from "playwright";
const base = "https://nestup-kappa.vercel.app";
const browser = await chromium.launch();

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));

  await page.goto(`${base}/browse/294c06fe-92ae-4da4-9af4-061dc3775bae`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  console.log(`\n=== ${theme} ===`);
  console.log("map before press:", await page.locator("canvas.maplibregl-canvas").count());

  await page.getByRole("button", { name: /open the map of/i }).click();
  await page.waitForTimeout(9000);
  const dialog = page.getByRole("dialog");
  console.log("legend:", (await dialog.locator("ul").first().innerText()).replace(/\n/g, " | "));
  await page.screenshot({ path: `nearby-${theme}.png` });
  console.log("page errors:", errs.length ? errs : "none");
  await ctx.close();
}
await browser.close();

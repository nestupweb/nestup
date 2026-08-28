import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const seen = [];
page.on("response", (r) => { if (/positron-en|dark-matter-en/.test(r.url())) seen.push(`${r.status()} ${r.url()} age=${r.headers()["age"] ?? "-"}`); });
await page.goto("http://localhost:3100/browse/x", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.goto("http://localhost:3100/browse", { waitUntil: "domcontentloaded" });
const hrefs = await page.locator('a[href^="/browse/"]').evaluateAll((e) => [...new Set(e.map((x) => x.getAttribute("href")))]);
for (const h of hrefs) {
  await page.goto("http://localhost:3100" + h, { waitUntil: "domcontentloaded" });
  const icon = page.getByRole("button", { name: /open the map of/i });
  if ((await icon.count()) !== 1) continue;
  await icon.click();
  await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 20000 });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: "probe.png" });
  console.log("room:", h);
  break;
}
console.log(seen.join("\n"));
await browser.close();

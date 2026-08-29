import { chromium } from "playwright";
const base = "https://nestup-kappa.vercel.app";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));

await page.goto(`${base}/browse`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const select = page.locator('select[name="safe_room"]');
console.log("filter present:", await select.count());
console.log("options:", await select.locator("option").allInnerTexts());

const before = await page.locator('a[href^="/browse/"]').count();
await select.selectOption("apartment");
await page.getByRole("button", { name: /apply filters/i }).click();
await page.waitForTimeout(3000);
console.log("url:", new URL(page.url()).search);
console.log("cards before/after:", before, await page.locator('a[href^="/browse/"]').count());
console.log("select keeps its value:", await page.locator('select[name="safe_room"]').inputValue());

// and the filter really narrows: "has one" should return at least as many
await page.goto(`${base}/browse?safe_room=has`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
console.log("has-one cards:", await page.locator('a[href^="/browse/"]').count());
await page.screenshot({ path: "mamad.png" });
console.log("page errors:", errs.length ? errs : "none");
await browser.close();

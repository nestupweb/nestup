import { chromium } from "playwright";
const base = "https://nestup-kappa.vercel.app";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.locator('input[type="email"]').fill("seed.user838@nestup.dev");
await page.locator('input[type="password"]').fill("Demo1234!");
await page.getByRole("button", { name: /sign in|log in/i }).first().click();
await page.waitForTimeout(4000);
console.log("after login:", new URL(page.url()).pathname);

await page.goto(`${base}/profile/edit`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const sel = page.locator('select[name="pref_safe_room"]');
console.log("field present:", await sel.count());
if (await sel.count()) {
  console.log("options:", await sel.locator("option").allInnerTexts());
  console.log("current:", await sel.inputValue());
  await sel.scrollIntoViewIfNeeded();
  await sel.selectOption("apartment");
  await page.getByRole("button", { name: /save/i }).first().click();
  await page.waitForTimeout(4500);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  console.log("after save + reload:", await page.locator('select[name="pref_safe_room"]').inputValue());
  await page.locator('select[name="pref_safe_room"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: "mamad-profile.png" });
}
console.log("page errors:", errs.length ? errs : "none");
await browser.close();

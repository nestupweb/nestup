import { chromium } from "playwright";

const base = "https://nestup-kappa.vercel.app";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const line = (label, got, want) =>
  console.log(`${got === want ? "LIVE  " : "NOT   "} ${label.padEnd(34)} got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);

// 1. Hover URL preview -------------------------------------------------------
await page.goto(`${base}/browse`, { waitUntil: "domcontentloaded", timeout: 60_000 });
const login = page.locator('header a[href="/login"]').first();
await login.waitFor({ timeout: 30_000 });
await login.hover();
const parked = await page.$eval("header", (h) => {
  const a = h.querySelector("a[data-parked-href]");
  return a ? a.getAttribute("data-parked-href") : null;
});
line("hover: href parked", parked, "/login");

// 2. Rent commas -------------------------------------------------------------
const maxRent = page.getByLabel(/max rent/i).first();
let rentType = "(field not found)";
let rentValue = "(n/a)";
if (await maxRent.count()) {
  rentType = await maxRent.getAttribute("type");
  await maxRent.click();
  await maxRent.pressSequentially("12500", { delay: 30 });
  rentValue = await maxRent.inputValue();
}
line("Max rent input type", rentType, "text");
line("Max rent shows commas", rentValue, "12,500");

// 3. Chat: photo + video -----------------------------------------------------
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.fill('input[name="email"]', "seed.user1@nestup.dev");
await page.fill('input[name="password"]', "Demo1234!");
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
  page.click('button[type="submit"]'),
]);
await page.goto(`${base}/chat`, { waitUntil: "domcontentloaded", timeout: 60_000 });
const thread = page.locator('a[href^="/chat/"]').first();
let accept = "(no thread found)";
if (await thread.count()) {
  await thread.click();
  await page.waitForURL(/\/chat\/[^/]+/, { timeout: 45_000 }).catch(() => {});
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 30_000 }).catch(() => {});
  accept = (await fileInput.count()) ? await fileInput.getAttribute("accept") : "(no file input)";
}
line("chat picker accept", accept, "image/*,video/*");

await browser.close();

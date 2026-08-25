import { chromium } from "playwright";
const base = "https://nestup-kappa.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "seed.user1@nestup.dev");
await page.fill('input[name="password"]', "Demo1234!");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }), page.click('button[type="submit"]')]);
await page.goto(`${base}/browse`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const nav = page.getByRole("navigation", { name: "Primary" });
const times = {};
for (const [label, path] of [["Profile","/profile"],["Chat","/chat"],["Swipe","/swipe"],["Listings","/browse"],["Profile","/profile"],["Swipe","/swipe"],["Chat","/chat"],["Listings","/browse"]]) {
  const t0 = Date.now();
  await nav.getByRole("link", { name: label }).click();
  await page.waitForURL((u) => u.pathname === path, { timeout: 30_000 });
  // wait until the new page's h1/main content is in the DOM
  await page.waitForFunction((p) => location.pathname === p && document.querySelector("main, h1"), path);
  (times[label] ??= []).push(Date.now() - t0);
  await page.waitForTimeout(1500);
}
console.log(JSON.stringify(times));
await browser.close();

import { chromium } from "playwright";
const base = "https://nestup-kappa.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(base + "/login", { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "nestup.tester@nestup.dev");
await page.fill('input[name="password"]', "Tester1234!");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), page.click('button[type="submit"]')]);
for (const path of ["/profile", "/profile/edit"]) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  const titled = await page.evaluate(() => [...document.querySelectorAll("main [title]")].map((e) => `${e.tagName.toLowerCase()}[title="${e.getAttribute("title")}"]`));
  console.log(path, "elements with title:", JSON.stringify(titled));
}
await browser.close();

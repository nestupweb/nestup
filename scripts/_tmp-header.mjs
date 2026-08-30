import { chromium } from "playwright";

const OUT = process.argv[2] ?? ".";
const SITE = "https://nestup-kappa.vercel.app";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const header = async () => {
  const h = page.locator("header");
  return {
    themeToggle: await h.getByRole("switch").count(),
    settings: await h.getByLabel("Settings").count(),
    logOut: await h.getByRole("button", { name: "Log out" }).count(),
    logIn: await h.getByRole("link", { name: "Log in" }).count(),
    signUp: await h.getByRole("link", { name: "Sign up" }).count(),
  };
};

// A visitor keeps the pills.
await page.goto(`${SITE}/browse`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
log("signed-out /browse header:", JSON.stringify(await header()));
await page.screenshot({ path: `${OUT}/hdr-1-visitor.png`, clip: { x: 0, y: 0, width: 1280, height: 120 } });

// A member gets the same three controls as everywhere else.
await page.goto(`${SITE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "seed.user1@nestup.dev");
await page.fill('input[name="password"]', "Demo1234!");
await Promise.all([page.waitForURL(/swipe/, { timeout: 60000 }), page.click('button[type="submit"]')]);

await page.goto(`${SITE}/browse`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
log("signed-in /browse header:", JSON.stringify(await header()));
await page.screenshot({ path: `${OUT}/hdr-2-member-listings.png`, clip: { x: 0, y: 0, width: 1280, height: 120 } });

await page.goto(`${SITE}/swipe`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
log("signed-in /swipe header:", JSON.stringify(await header()));

// A room page is in the same group — it should match too.
await page.goto(`${SITE}/browse`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const firstRoom = page.locator('a[href^="/browse/"]').first();
if (await firstRoom.count()) {
  await firstRoom.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  log("signed-in room page header:", JSON.stringify(await header()), page.url());
}

// The gear goes to settings, and Log out from Listings really signs out.
await page.goto(`${SITE}/browse`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.locator("header").getByLabel("Settings").click();
await page.waitForLoadState("networkidle");
log("gear went to:", page.url());

await page.goto(`${SITE}/browse`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.locator("header").getByRole("button", { name: "Log out" }).click();
await page.waitForTimeout(4000);
log("after Log out from Listings:", page.url(), JSON.stringify(await header()));
await page.screenshot({ path: `${OUT}/hdr-3-after-logout.png` });

await browser.close();

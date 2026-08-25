/**
 * Real-browser check that internal navigation stays in one tab and goes through
 * the client-side router (no full reload). Logs in as a demo account, clicks the
 * primary nav (Swipe → Listings → Chat → Profile), a listing card, the logo and
 * Profile → Edit, and fails if a second page opens, a JS marker is lost (page
 * reloaded), or any same-origin anchor carries a target/onclick attribute.
 *
 * Usage:  npm run check:nav                      (against http://localhost:3000)
 *         npm run check:nav -- https://nestup-kappa.vercel.app
 * Env:    SEED_EMAIL / SEED_PASSWORD override the demo login (default seed.user1 / Demo1234!).
 */
import { chromium } from "playwright";

const base = (process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.SEED_EMAIL ?? "seed.user1@nestup.dev";
const password = process.env.SEED_PASSWORD ?? "Demo1234!";

const failures = [];
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => {
    window.__sameTabMarker = "alive";
  });

  const audit = async () => {
    const bad = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll("a[href]")].filter((a) => a.origin === location.origin);
      return {
        target: anchors.filter((a) => a.hasAttribute("target")).map((a) => a.getAttribute("href")),
        onclick: anchors.filter((a) => a.hasAttribute("onclick")).map((a) => a.getAttribute("href")),
        base: Boolean(document.querySelector("base")),
        formTarget: document.querySelectorAll("form[target]").length,
      };
    });
    const path = new URL(page.url()).pathname;
    if (bad.target.length) failures.push(`${path}: internal anchors with target: ${bad.target.join(", ")}`);
    if (bad.onclick.length) failures.push(`${path}: internal anchors with onclick: ${bad.onclick.join(", ")}`);
    if (bad.base) failures.push(`${path}: <base> element present`);
    if (bad.formTarget) failures.push(`${path}: ${bad.formTarget} form(s) with a target attribute`);
  };

  const click = async (label, locator, expectPath) => {
    // Pages like /browse stream their content behind a loading boundary — give
    // the link a moment to attach before deciding it isn't there.
    await locator.first().waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
    if (!(await locator.count())) {
      console.log(`skip   ${label} (not on this page)`);
      return;
    }
    const before = context.pages().length;
    await Promise.all([
      page.waitForURL((u) => expectPath.test(u.pathname), { timeout: 45_000 }),
      locator.first().click(),
    ]);
    await page.waitForLoadState("networkidle").catch(() => {});
    const marker = await page.evaluate(() => window.__sameTabMarker);
    const after = context.pages().length;
    const ok = after === before && marker === "alive";
    console.log(`${ok ? "ok    " : "FAIL  "} ${label.padEnd(24)} → ${new URL(page.url()).pathname}  tabs ${before}→${after}  client-side=${marker === "alive"}`);
    if (after !== before) failures.push(`${label}: opened a new tab/window`);
    if (marker !== "alive") failures.push(`${label}: full page reload (client-side routing bypassed)`);
    await audit();
  };

  await audit();
  const nav = (href) => page.locator(`nav[aria-label="Primary"] a[href="${href}"]`);
  await click("nav Swipe", nav("/swipe"), /^\/swipe$/);
  await click("nav Listings", nav("/browse"), /^\/browse$/);
  await click("listing card", page.locator('a[href^="/browse/"]'), /^\/browse\/[^/]+$/);
  await click("header logo", page.locator("header a").first(), /^\/(browse)?$/);
  await click("nav Chat", nav("/chat"), /^\/chat$/);
  await click("chat thread", page.locator('a[href^="/chat/"]'), /^\/chat\/[^/]+$/);
  await click("nav Profile", nav("/profile"), /^\/profile$/);
  await click("profile → edit", page.locator('a[href="/profile/edit"]'), /^\/profile\/edit$/);
  await click("nav Swipe (again)", nav("/swipe"), /^\/swipe$/);
} catch (e) {
  failures.push(`run aborted: ${e.message}`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("\nSame-tab navigation check FAILED:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`\nSame-tab navigation check passed against ${base}: every internal link stayed in one tab via the client-side router.`);

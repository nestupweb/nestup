import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const fails = [];
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "ok    " : "FAIL  "} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails.push(label);
};

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${base}/browse`, { waitUntil: "networkidle" });

const sel = 'header a[href="/login"]';
await page.locator(sel).first().waitFor({ timeout: 20_000 });

const state = () =>
  page.$eval(`header a[href="/login"], header a[data-parked-href="/login"]`, (a) => ({
    href: a.getAttribute("href"),
    parked: a.getAttribute("data-parked-href"),
    cursor: getComputedStyle(a).cursor,
  }));

// 1. At rest: a normal link.
let s = await state();
ok("at rest: href present", s.href === "/login" && s.parked === null, JSON.stringify(s));

// 2. Hovering: href gone (this is what hides the browser's URL chip).
await page.locator(sel).first().hover();
s = await state();
ok("hovering: href removed", s.href === null, JSON.stringify(s));
ok("hovering: href parked in data-parked-href", s.parked === "/login");
ok("hovering: cursor still pointer", s.cursor === "pointer", s.cursor);

// 3. Moving away: href back.
await page.mouse.move(5, 400);
s = await state();
ok("after moving away: href restored", s.href === "/login" && s.parked === null, JSON.stringify(s));

// 4. Pressing while hovered restores the href before the click lands.
await page.locator(sel).first().hover();
await page.mouse.down();
s = await state();
ok("on press: href restored before click", s.href === "/login", JSON.stringify(s));
await page.mouse.up();

await page.waitForURL((u) => u.pathname === "/login", { timeout: 20_000 }).catch(() => {});
ok("click navigated", new URL(page.url()).pathname === "/login", page.url());
ok("stayed in one tab", context.pages().length === 1, `tabs=${context.pages().length}`);

// 5. ctrl-click still opens a new tab (href is real by the time the click fires).
await page.goto(`${base}/browse`, { waitUntil: "networkidle" });
await page.evaluate(() => { window.__marker = "alive"; });
const [popup] = await Promise.all([
  context.waitForEvent("page", { timeout: 10_000 }).catch(() => null),
  page.locator(sel).first().click({ modifiers: ["ControlOrMeta"] }),
]);
ok("ctrl-click still opens a new tab", Boolean(popup), popup ? await popup.url() : "no popup");
if (popup) await popup.close();

// 6. Right-click leaves a real href for "Copy link address".
await page.locator(sel).first().hover();
await page.locator(sel).first().click({ button: "right" });
s = await state();
ok("right-click: href restored", s.href === "/login", JSON.stringify(s));

// 7. Keyboard focus also parks it, and Enter still follows the link. Must be a
// real Tab, not locator.focus() — programmatic focus is not :focus-visible.
await page.keyboard.press("Escape");
await page.mouse.move(5, 400);
await page.goto(`${base}/browse`, { waitUntil: "networkidle" });
await page.evaluate(() => { window.__marker = "alive"; });
for (let i = 0; i < 25; i++) {
  await page.keyboard.press("Tab");
  const onIt = await page.evaluate(() => {
    const a = document.activeElement;
    return a?.tagName === "A" && (a.getAttribute("href") === "/login" || a.dataset.parkedHref === "/login");
  });
  if (onIt) break;
}
s = await state();
ok("keyboard focus: href removed", s.href === null, JSON.stringify(s));
await page.keyboard.press("Enter");
await page.waitForURL((u) => u.pathname === "/login", { timeout: 20_000 }).catch(() => {});
const marker = await page.evaluate(() => window.__marker);
ok("Enter followed the link", new URL(page.url()).pathname === "/login", page.url());
ok("navigation was client-side (no reload)", marker === "alive", `marker=${marker}`);

await browser.close();
console.log(fails.length ? `\nFAILED: ${fails.join(", ")}` : "\nAll hover checks passed.");
process.exit(fails.length ? 1 : 0);

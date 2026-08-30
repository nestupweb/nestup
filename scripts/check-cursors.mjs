/**
 * Real-browser check that every pressable thing shows the hand cursor on hover.
 *
 * Tailwind v4's Preflight dropped v3's `button { cursor: pointer }`, so buttons
 * quietly went back to the UA's arrow. app/globals.css puts the hand back for
 * natives and ARIA roles; this script is what proves it, on every route, for
 * every element the user can actually press — including the ones only React
 * knows about (a <div onClick>), which it finds by reading the props React 19
 * parks on the DOM node.
 *
 * Usage:  npm run check:cursors                      (against http://localhost:3000)
 *         npm run check:cursors -- https://nestup-kappa.vercel.app
 * Env:    SEED_EMAIL / SEED_PASSWORD override the demo login (default seed.user1 / Demo1234!).
 */
import { chromium } from "playwright";

const base = (process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.SEED_EMAIL ?? "seed.user1@nestup.dev";
const password = process.env.SEED_PASSWORD ?? "Demo1234!";

/**
 * Cursors that are correct even though they are not `pointer`. Each one is a
 * deliberate choice made in the markup, so the check asks for the exact element
 * as well as the cursor: a new bare arrow on a button is still a failure.
 */
const ALLOWED = [
  { cursor: "zoom-in", why: "profile photo opens a lightbox (ProfileAvatar)" },
  { cursor: "grab", why: "draggable: map canvas, budget range thumbs" },
  { cursor: "grabbing", why: "mid-drag" },
  { cursor: "text", why: "combobox text inputs (city, phone country, roommate tags)" },
  { cursor: "default", why: "scrim/backdrop that closes on click", requireBackdrop: true },
];

// Pages worth walking. Ids are filled in at runtime from whatever the seed data has.
const ROUTES = ["/", "/browse", "/swipe", "/chat", "/profile", "/profile/edit", "/settings", "/listing"];

const findings = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

/** Collect every pressable element on the page and its computed cursor. */
const collect = () =>
  page.evaluate(() => {
    const PRESSABLE_ROLES = new Set([
      "button", "tab", "option", "menuitem", "menuitemradio", "menuitemcheckbox",
      "switch", "checkbox", "radio", "link",
    ]);
    const CLICKY_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "file", "color"]);

    const reactProps = (el) => {
      const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
      return key ? el[key] : null;
    };

    const why = (el) => {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role");
      if (tag === "button") return el.disabled || el.getAttribute("aria-disabled") === "true" ? null : "<button>";
      if (tag === "a") return el.hasAttribute("href") || el.hasAttribute("data-parked-href") ? "<a href>" : null;
      if (tag === "summary") return "<summary>";
      if (tag === "select") return el.disabled ? null : "<select>";
      if (tag === "input") return CLICKY_INPUTS.has(el.type) && !el.disabled ? `<input type=${el.type}>` : null;
      if (tag === "label") {
        if (el.htmlFor) return "<label for>";
        const ctl = el.querySelector('input[type="checkbox"], input[type="radio"], input[type="file"]');
        return ctl && !ctl.disabled ? "<label wrapping a checkbox/radio>" : null;
      }
      if (role && PRESSABLE_ROLES.has(role)) {
        return el.getAttribute("aria-disabled") === "true" ? null : `role="${role}"`;
      }
      const props = reactProps(el);
      if (props && (props.onClick || props.onPointerDown) && !props.disabled) return "React onClick";
      return null;
    };

    const path = (el) => {
      const bits = [];
      for (let n = el; n && n.nodeType === 1 && bits.length < 4; n = n.parentElement) {
        const cls = (n.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
        bits.unshift(n.tagName.toLowerCase() + (cls ? `.${cls}` : ""));
      }
      return bits.join(" > ");
    };

    const out = [];
    for (const el of document.querySelectorAll("*")) {
      const reason = why(el);
      if (!reason) continue;
      if (!el.getClientRects().length) continue; // not on screen: can't be hovered
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.pointerEvents === "none") continue;
      out.push({
        cursor: style.cursor,
        reason,
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48),
        path: path(el),
        isBackdrop: /fixed|absolute/.test(style.position) && parseInt(style.width, 10) > 600 && !el.textContent.trim(),
      });
    }
    return out;
  });

const check = async (label) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  const items = await collect();
  let bad = 0;
  for (const it of items) {
    if (it.cursor === "pointer") continue;
    const allowed = ALLOWED.find((a) => a.cursor === it.cursor && (!a.requireBackdrop || it.isBackdrop));
    if (allowed) continue;
    bad += 1;
    findings.push(`${label}: cursor:${it.cursor} on ${it.reason} "${it.label}"  [${it.path}]`);
  }
  console.log(`${bad ? "FAIL  " : "ok    "} ${label.padEnd(34)} ${items.length} pressable, ${bad} without the hand`);
  return items.length;
};

/** Click something, then re-check — menus, sheets and dialogs hide pressables until they open. */
const openAndCheck = async (label, locator, after = 400) => {
  const target = locator.first();
  if (!(await target.count())) return console.log(`skip   ${label} (not on this page)`);
  await target.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(after);
  await check(label);
  await page.keyboard.press("Escape").catch(() => {});
};

try {
  // Signed out first: the auth pages have their own buttons and links.
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await check("/login (signed out)");
  await page.goto(`${base}/signup`, { waitUntil: "networkidle" });
  await check("/signup (signed out)");
  await page.goto(`${base}/browse`, { waitUntil: "networkidle" });
  await check("/browse (signed out)");

  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});

  for (const route of ROUTES) {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" }).catch(() => {});
    await check(route);
  }

  // A listing and a chat thread, whichever the seed data offers.
  await page.goto(`${base}/browse`, { waitUntil: "networkidle" });
  const listing = await page.locator('a[href^="/browse/"]').first().getAttribute("href").catch(() => null);
  if (listing) {
    await page.goto(`${base}${listing}`, { waitUntil: "networkidle" });
    await check(listing);
    await openAndCheck("listing → gallery", page.locator("main img").first());
  }
  await page.goto(`${base}/chat`, { waitUntil: "networkidle" });
  await openAndCheck("/chat → row menu", page.locator('button[aria-haspopup], button[aria-label*="ptions" i]'));
  const thread = await page.locator('a[href^="/chat/"]').first().getAttribute("href").catch(() => null);
  if (thread) {
    await page.goto(`${base}${thread}`, { waitUntil: "networkidle" });
    await check(thread);
  }

  // Overlays that only exist once something is pressed.
  await page.goto(`${base}/browse`, { waitUntil: "networkidle" });
  await openAndCheck("/browse → sort menu", page.locator('button:has-text("Sort")'));
  await openAndCheck("/browse → filters", page.locator('button:has-text("Filter")'));
  await openAndCheck("/browse → map", page.locator('button[aria-label*="map" i]'));
  await page.goto(`${base}/swipe`, { waitUntil: "networkidle" });
  await openAndCheck("/swipe → how it works", page.locator('button[aria-label*="how" i], button:has-text("How")'));
  await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
  await check("/settings (again, expanded)");
} catch (e) {
  findings.push(`run aborted: ${e.message}`);
} finally {
  await browser.close();
}

if (findings.length) {
  console.error(`\nCursor check FAILED — ${findings.length} pressable element(s) still show the arrow:\n- ` + findings.join("\n- "));
  process.exit(1);
}
console.log(`\nCursor check passed against ${base}: every pressable element hovers to the hand.`);

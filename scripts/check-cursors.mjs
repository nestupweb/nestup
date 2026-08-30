/**
 * Checks that every pressable thing in the app shows the hand cursor on hover.
 *
 * Tailwind v4's Preflight dropped v3's `button { cursor: pointer }`, so buttons
 * quietly went back to the UA's arrow — Log out, the menus, the swipe controls.
 * app/globals.css puts the hand back for natives and ARIA roles; this script is
 * what proves it, in two passes:
 *
 *   1. source — every pressable JSX element in app/ and components/, including
 *      the ones no sweep would ever render (dialogs, error states, empty
 *      states). Each must be a tag or role the global rule covers, or carry its
 *      own `cursor-*` class, or be marked `data-cursor="arrow"`.
 *   2. browser — real computed styles on every route, signed out and signed in,
 *      desktop and phone widths, with menus and sheets opened. Catches what the
 *      source pass cannot: inherited cursors, overlays, third-party markup
 *      (MapLibre's controls), and anything a class name only looked right in.
 *
 * Pass 1 needs nothing running. Pass 2 needs a server:
 *   npm run check:cursors                              (http://localhost:3000)
 *   npm run check:cursors -- https://nestup-kappa.vercel.app
 *   npm run check:cursors -- --source-only             (skip the browser)
 * Env: SEED_EMAIL / SEED_PASSWORD override the demo login (seed.user1 / Demo1234!).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const sourceOnly = args.includes("--source-only");
const base = (args.find((a) => !a.startsWith("--")) ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.SEED_EMAIL ?? "seed.user1@nestup.dev";
const password = process.env.SEED_PASSWORD ?? "Demo1234!";

/** Roles the global rule in app/globals.css gives the hand to. */
const PRESSABLE_ROLES = new Set([
  "button", "tab", "option", "menuitem", "menuitemradio", "menuitemcheckbox",
  "switch", "checkbox", "radio", "link",
]);
const CLICKY_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "file", "color"]);
/** Non-pointer cursors that are unmistakably deliberate: none of them can hide a stray arrow. */
const DELIBERATE = new Set(["zoom-in", "zoom-out", "grab", "grabbing", "text", "not-allowed", "move", "crosshair", "wait", "progress"]);

const findings = [];

/* ─────────────────────────── pass 1: source ─────────────────────────── */

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "node_modules" || name === ".next") return [];
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });

/** Read the JSX opening tag that owns the attribute at `idx`, brace-aware. */
const tagAt = (text, idx) => {
  let i = idx, depth = 0;
  for (; i > 0; i--) {
    const c = text[i];
    if (c === "}") depth++;
    else if (c === "{") depth--;
    else if (c === "<" && depth <= 0 && /[A-Za-z]/.test(text[i + 1] ?? "")) break;
  }
  let j = i, d = 0;
  for (; j < text.length; j++) {
    const c = text[j];
    if (c === "{") d++;
    else if (c === "}") d--;
    else if (c === ">" && d === 0 && text[j - 1] !== "=") break;
  }
  return { start: i, attrs: text.slice(i, j + 1) };
};

const sourceFiles = [...walk("app"), ...walk("components")].filter((f) => !f.includes("ui\\map.tsx") && !f.includes("ui/map.tsx"));
let sourceChecked = 0;

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  const seen = new Set();
  for (const m of text.matchAll(/\bonClick=|\bonPointerDown=|\brole="([a-z]+)"|<(button|summary|select)\b/g)) {
    const { start, attrs } = tagAt(text, m.index);
    if (seen.has(start)) continue;
    seen.add(start);

    const tag = attrs.match(/^<([A-Za-z][\w.]*)/)?.[1];
    if (!tag || !/^[a-z][a-z0-9]*$/.test(tag)) continue; // a component: checked where it is defined
    const role = attrs.match(/role="([a-z]+)"/)?.[1];
    const type = attrs.match(/type="([a-z]+)"/)?.[1];
    const hasHandler = /\bonClick=|\bonPointerDown=/.test(attrs);
    const swallowsOnly = /onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(attrs);
    const disabled = /\bdisabled(=\{true\})?[\s/>]/.test(attrs) || /aria-disabled="true"/.test(attrs);

    const pressable =
      tag === "button" || tag === "summary" || tag === "select" ||
      (tag === "a" && /\bhref=|data-parked-href/.test(attrs)) ||
      (tag === "input" && CLICKY_INPUTS.has(type ?? "")) ||
      (tag === "label" && (/\bhtmlFor=/.test(attrs) || /checkbox|radio/.test(attrs))) ||
      (role && PRESSABLE_ROLES.has(role)) ||
      (hasHandler && !swallowsOnly);
    if (!pressable || disabled) continue;
    sourceChecked++;

    const coveredByRule =
      ["button", "summary", "select", "a"].includes(tag) ||
      (tag === "input" && CLICKY_INPUTS.has(type ?? "")) ||
      (tag === "label" && /\bhtmlFor=/.test(attrs)) ||
      (role && PRESSABLE_ROLES.has(role));
    const ownsCursor = /cursor-[a-z-]+/.test(attrs) || /data-cursor="arrow"/.test(attrs);
    if (coveredByRule || ownsCursor) continue;

    const line = text.slice(0, start).split("\n").length;
    findings.push(`source ${file.replace(/\\/g, "/")}:${line} — <${tag}> is pressable but no rule gives it the hand: ${attrs.replace(/\s+/g, " ").slice(0, 90)}`);
  }
}
console.log(`${findings.length ? "FAIL  " : "ok    "} source pass — ${sourceChecked} pressable elements across ${sourceFiles.length} files, ${findings.length} uncovered`);

if (sourceOnly) {
  report();
}

/* ─────────────────────────── pass 2: browser ─────────────────────────── */

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const collect = () =>
  page.evaluate(({ roles, inputs }) => {
    const PRESSABLE_ROLES = new Set(roles);
    const CLICKY_INPUTS = new Set(inputs);
    const reactProps = (el) => {
      const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
      return key ? el[key] : null;
    };
    const why = (el) => {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role");
      if (el.disabled || el.getAttribute("aria-disabled") === "true") return null;
      if (tag === "button") return "<button>";
      if (tag === "a") return el.hasAttribute("href") || el.hasAttribute("data-parked-href") ? "<a href>" : null;
      if (tag === "summary") return "<summary>";
      if (tag === "select") return "<select>";
      if (tag === "input") return CLICKY_INPUTS.has(el.type) ? `<input type=${el.type}>` : null;
      if (tag === "label") {
        if (el.htmlFor) return "<label for>";
        const ctl = el.querySelector('input[type="checkbox"], input[type="radio"], input[type="file"]');
        return ctl && !ctl.disabled ? "<label wrapping a checkbox/radio>" : null;
      }
      if (role && PRESSABLE_ROLES.has(role)) return `role="${role}"`;
      const props = reactProps(el);
      if (props && (props.onClick || props.onPointerDown) && !props.disabled) return "React onClick";
      return null;
    };
    const path = (el) => {
      const bits = [];
      for (let n = el; n && n.nodeType === 1 && bits.length < 3; n = n.parentElement) {
        const cls = (n.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
        bits.unshift(n.tagName.toLowerCase() + (cls ? `.${cls}` : ""));
      }
      return bits.join(" > ");
    };
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      const reason = why(el);
      if (!reason || !el.getClientRects().length) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.pointerEvents === "none") continue;
      out.push({
        cursor: style.cursor,
        reason,
        marked: el.getAttribute("data-cursor") === "arrow",
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 44),
        path: path(el),
      });
    }
    return out;
  }, { roles: [...PRESSABLE_ROLES], inputs: [...CLICKY_INPUTS] });

const check = async (label) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  const items = await collect();
  let bad = 0;
  for (const it of items) {
    if (it.cursor === "pointer") continue;
    if (it.marked && it.cursor === "default") continue; // a scrim, on purpose
    if (DELIBERATE.has(it.cursor)) continue;
    bad++;
    findings.push(`${label}: cursor:${it.cursor} on ${it.reason} "${it.label}"  [${it.path}]`);
  }
  console.log(`${bad ? "FAIL  " : "ok    "} ${label.padEnd(36)} ${String(items.length).padStart(3)} pressable, ${bad} without the hand`);
  return items.length;
};

const go = async (path, label = path) => {
  const res = await page.goto(`${base}${path}`, { waitUntil: "networkidle" }).catch(() => null);
  if (res && res.status() >= 500) {
    findings.push(`${label}: server returned ${res.status()} — page not audited`);
    console.log(`FAIL   ${label.padEnd(36)} HTTP ${res.status()}`);
    return false;
  }
  await check(label);
  return true;
};

/**
 * Open a menu/sheet, re-check, close. Menus hide most of their pressables until
 * then — and an opener that silently does nothing would leave those unaudited
 * while the run still looked green, so a no-op is a finding, not a skip.
 */
const openAndCheck = async (label, selector, expect = '[role="dialog"], [role="menu"], [role="menubar"]') => {
  const target = page.locator(selector).first();
  if (!(await target.count())) return console.log(`skip   ${label} (not on this page)`);
  const before = await page.locator(expect).count();
  await target.click({ timeout: 5000 }).catch(() => {});
  await page.locator(expect).nth(before).waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if ((await page.locator(expect).count()) <= before) {
    findings.push(`${label}: nothing opened on click — its pressables were not audited`);
    console.log(`FAIL   ${label.padEnd(36)} did not open`);
    return;
  }
  await check(label);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(200);
};

try {
  await go("/login", "/login (signed out)");
  await go("/signup", "/signup (signed out)");
  await go("/forgot-password", "/forgot-password (signed out)");
  await go("/browse", "/browse (signed out)");

  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});

  for (const route of ["/", "/browse", "/swipe", "/chat", "/profile", "/profile/edit", "/settings", "/listing"]) {
    await go(route);
  }

  // Overlays that only exist once something is pressed.
  await go("/browse");
  await openAndCheck("/browse → sort menu", 'button[aria-haspopup="menu"][aria-label^="Sort"]');
  await openAndCheck("/browse → map", 'button[aria-label*="map" i]');
  // Settings hides each form behind a "Change" row. Expand them all — but never
  // press anything in Danger zone: "Delete my account" is one armed field away
  // from ending the seed account, and an audit must not be able to do that.
  await go("/settings");
  const changes = page.locator('button:has-text("Change")');
  for (let i = 0; i < (await changes.count()); i++) {
    await changes.nth(i).click({ timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
  await check("/settings (rows expanded)");

  // Detail pages, whichever ids the seed data offers.
  await go("/browse");
  const listing = await page.locator('a[href^="/browse/"]').first().getAttribute("href").catch(() => null);
  if (listing) await go(listing, `listing ${listing}`); // gallery is prev/next buttons, no lightbox
  await go("/chat");
  await openAndCheck("/chat → row menu", 'button[aria-label^="Options for the chat"]');
  const thread = await page.locator('a[href^="/chat/"]').first().getAttribute("href").catch(() => null);
  if (thread && (await go(thread, `chat ${thread}`))) {
    await openAndCheck("chat → schedule viewing", 'button[aria-label="Schedule a viewing"]');
    // Only a thread that has a photo in it can open the lightbox.
    await openAndCheck("chat → photo lightbox", 'button[aria-label="Open photo"]');
  }
  const person = await page.locator('a[href^="/people/"]').first().getAttribute("href").catch(() => null);
  if (person && (await go(person, `person ${person}`))) {
    await openAndCheck("person → report/block", 'button[aria-haspopup="menu"]');
  }

  // Phone width: the controls that only exist below `lg` (Filters, bottom nav).
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/browse", "/swipe", "/profile"]) {
    await go(route, `${route} (phone width)`);
  }
  await go("/browse");
  await openAndCheck("/browse → filters (phone)", 'button:has-text("Filters")');
} catch (e) {
  findings.push(`run aborted: ${e.message}`);
} finally {
  await browser.close();
}

report();

function report() {
  if (findings.length) {
    console.error(`\nCursor check FAILED — ${findings.length} problem(s):\n- ` + findings.join("\n- "));
    process.exit(1);
  }
  console.log(`\nCursor check passed${sourceOnly ? " (source pass only)" : ` against ${base}`}: every pressable element hovers to the hand.`);
  process.exit(0);
}

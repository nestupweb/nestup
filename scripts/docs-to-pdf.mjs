/**
 * Print the built HTML in `docs/submission/.pdf-build/` to PDF.
 *
 * Run `python scripts/docs-to-pdf.py` first — that renders the markdown, which
 * stays the source of truth. This step only drives headless Chromium's print
 * engine, which is what gives real page breaks, repeated table headers and a
 * page footer.
 *
 * Usage: node scripts/docs-to-pdf.mjs
 */
import { chromium } from "playwright";
import { readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// `new URL("../")` already resolves to the project root; passing it through
// `path.dirname` strips one level too many and lands outside the repo.
const root = fileURLToPath(new URL("../", import.meta.url));
const build = path.join(root, "docs", "submission", ".pdf-build");
const out = path.join(root, "docs", "submission", "pdf");
mkdirSync(out, { recursive: true });

// Footer only: the cover carries the title, and a running header on page 1
// would sit on top of it.
const footer = `
<div style="width:100%;font-family:'IBM Plex Sans',sans-serif;font-size:7.5pt;color:#8a847c;
            padding:0 18mm;display:flex;justify-content:space-between;">
  <span>NestUp &middot; RUNI CS 2026</span>
  <span class="pageNumber"></span>
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage();

const files = readdirSync(build).filter((f) => f.endsWith(".html")).sort();
for (const file of files) {
  await page.goto("file:///" + path.join(build, file).replace(/\\/g, "/"), {
    waitUntil: "networkidle",
  });
  // `networkidle` is NOT enough on its own: it fires once the CSS has arrived,
  // which can be before the font files it references have. The first run of
  // this script produced PDFs set in Arial for exactly that reason.
  // `document.fonts` is the only thing that actually knows.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 30000 });

  const loaded = await page.evaluate(() =>
    ["Bricolage Grotesque", "IBM Plex Sans", "IBM Plex Mono"]
      .filter((f) => document.fonts.check(`12px "${f}"`))
  );
  if (loaded.length < 3) {
    console.warn("  ! " + file + ": only [" + loaded.join(", ") + "] loaded — PDF will fall back");
  }

  const pdf = file.replace(".html", ".pdf");
  await page.pdf({
    path: path.join(out, pdf),
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: footer,
    margin: { top: "18mm", bottom: "18mm", left: "18mm", right: "18mm" },
  });
  console.log("wrote", pdf);
}

await browser.close();

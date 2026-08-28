/**
 * English-label copies of the two basemaps the app draws on.
 *
 * mapcn's default cartography is CARTO's Positron and Dark Matter, which is
 * what the map is back to. Their street labels come straight from the tiles'
 * `name` field, and in Israel that field is Hebrew — so a room in Tel Aviv sat
 * on a map the user couldn't read. The tiles carry the translations too
 * (`name:en`, and OpenMapTiles' generated `name:latin`), the styles just don't
 * ask for them.
 *
 * So this fetches both styles once and rewrites every symbol layer that prints
 * a name to ask for English first and fall back through Latin script to the
 * local name. Nothing else about the cartography changes; the sources, sprites
 * and glyphs stay CARTO's own absolute URLs, so the output is a style file we
 * serve and CARTO still serves the tiles.
 *
 * The result is committed (public/maplibre/*-en.json, ~50 KB each): Vercel
 * doesn't have /scripts, so this must never become a build step.
 *
 * Re-run after CARTO changes its styles: npm run basemap:english
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STYLES = [
  ["positron-en.json", "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"],
  ["dark-matter-en.json", "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"],
];

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre");

/**
 * The English name, and nothing else.
 *
 * Just `name:en`, the real OSM tag. Everything nearby that looks like a wider
 * net is a trap, and this took three tries to get right:
 *
 *   · `name` is the local name — Hebrew, which is what started all this.
 *   · `name_en` is OpenMapTiles' older field, and it is defined as *English or
 *     the local name* — so it quietly puts the Hebrew back. This is what left
 *     one green park label reading "גן גבעות" on an otherwise English map of
 *     Acre, long after `name` itself was gone.
 *   · `name:latin` has the same fallback behaviour for scripts it can't
 *     transliterate, and Hebrew is one of them.
 *
 * So a feature nobody has given an English name goes unlabelled. In Israel
 * that costs very little: `name:en` is on almost every street (Katzrin 101 of
 * 101, Rosh Pinna 121 of 124, measured against OSM directly), and what it
 * loses is mostly small parks and the odd building.
 */
export const ENGLISH_LABEL = ["get", "name:en"];

/** True for a text-field that prints a place's name in any of the style's forms. */
function printsAName(field) {
  return JSON.stringify(field ?? null).includes("{name");
}

for (const [file, url] of STYLES) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const style = await res.json();

  let rewritten = 0;
  for (const layer of style.layers) {
    if (layer.type !== "symbol" || !layer.layout) continue;
    if (!printsAName(layer.layout["text-field"])) continue; // house numbers, shields
    layer.layout["text-field"] = ENGLISH_LABEL;
    rewritten++;
  }
  if (rewritten === 0) throw new Error(`${file}: no name labels found — did the style change?`);

  style.name = `${style.name} (English)`;
  writeFileSync(join(out, file), JSON.stringify(style));
  console.log(`${file} — ${rewritten} label layer(s) switched to English`);
}

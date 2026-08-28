/**
 * Derives a dark basemap from OpenFreeMap's Liberty style.
 *
 * Liberty is the one keyless style that names the cafés, bars and shops on a
 * street (which is what the map is for since 2026-08-28), and it has no dark
 * twin. Rather than run a different cartography in dark mode — different
 * roads, different labels, Hebrew-only names — this flips Liberty's own
 * palette: every paint colour is converted to HSL, its lightness inverted and
 * compressed into the dark end, and label colours are swapped for a light ink
 * with a dark halo. The POI sprites stay as they are; coloured icons read well
 * on a dark ground.
 *
 * Writes public/maplibre/liberty-dark.json (~45 KB), which the app serves
 * itself, so dark mode needs no second tile provider. Re-run after OpenFreeMap
 * changes Liberty: npm run basemap:dark
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://tiles.openfreemap.org/styles/liberty";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "maplibre", "liberty-dark.json");

/** Label ink and its halo, in the app's dark palette (globals.css). */
const TEXT = "#e7e1d7";
const HALO = "#14120f";

const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const rgbish = /^rgba?\(([^)]+)\)$/i;
const hslish = /^hsla?\(([^)]+)\)$/i;

function parse(colour) {
  if (typeof colour !== "string") return null;
  const value = colour.trim();

  if (hex.test(value)) {
    const raw = value.slice(1);
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    return { ...rgbToHsl(...[0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)), a: 1 };
  }
  const rgb = rgbish.exec(value);
  if (rgb) {
    const parts = rgb[1].split(",").map((p) => parseFloat(p));
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    return { ...rgbToHsl(parts[0] / 255, parts[1] / 255, parts[2] / 255), a: parts[3] ?? 1 };
  }
  const hsl = hslish.exec(value);
  if (hsl) {
    const parts = hsl[1].split(",").map((p) => parseFloat(p));
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    return { h: parts[0], s: parts[1] / 100, l: parts[2] / 100, a: parts[3] ?? 1 };
  }
  return null;
}

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/**
 * Light → dark. The inversion alone would produce a washed-out grey map, so
 * the inverted lightness is squeezed into 0.06–0.34 and the saturation halved:
 * dark enough to sit under the app's dark theme, with just enough colour left
 * that water still reads as water and parks as parks.
 */
function darken(colour) {
  const c = parse(colour);
  if (!c) return colour;
  const l = 0.06 + (1 - c.l) * 0.28;
  const s = Math.min(c.s * 0.5, 0.5);
  return `hsla(${Math.round(c.h)},${Math.round(s * 100)}%,${Math.round(l * 100)}%,${c.a})`;
}

/** Paint values are often expressions; the colours sit at the leaves. */
function walk(value, fn) {
  if (Array.isArray(value)) return value.map((v) => walk(v, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, fn)]));
  }
  return typeof value === "string" ? fn(value) : value;
}

const style = await (await fetch(SOURCE)).json();
style.name = "Liberty (dark)";
style.id = "liberty-dark";

let touched = 0;
for (const layer of style.layers) {
  if (!layer.paint) continue;
  for (const [prop, value] of Object.entries(layer.paint)) {
    if (prop === "text-color") layer.paint[prop] = TEXT;
    else if (prop === "text-halo-color") layer.paint[prop] = HALO;
    else if (/color/.test(prop)) layer.paint[prop] = walk(value, darken);
    else continue;
    touched++;
  }
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(style));
console.log(`liberty-dark.json written — ${style.layers.length} layers, ${touched} paint colours re-toned`);

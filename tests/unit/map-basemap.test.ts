import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { MAP_COLORS, MAP_STYLES } from "@/components/map/basemap";

const css = readFileSync(join(import.meta.dirname, "../../app/globals.css"), "utf8");

/** Pulls one custom property out of a block of globals.css. */
function token(block: string, name: string): string {
  const start = css.indexOf(block);
  expect(start, `${block} not found in globals.css`).toBeGreaterThan(-1);
  const scope = css.slice(start, css.indexOf("}", start));
  return new RegExp(`--${name}:\s*([^;]+);`).exec(scope)?.[1].trim() ?? "";
}

describe("map colours", () => {
  // MapLibre paints in WebGL, so these hexes are copies of the stylesheet's
  // rather than reads of it. Copies drift; this is the thing that notices.
  test("match the palette in globals.css", () => {
    expect(MAP_COLORS.light.accent).toBe(token(":root {", "accent"));
    expect(MAP_COLORS.light.on).toBe(token(":root {", "accent-contrast"));
    expect(MAP_COLORS.light.ring).toBe(token(":root {", "paper"));
    expect(MAP_COLORS.dark.accent).toBe(token('[data-theme="dark"] {', "accent"));
    expect(MAP_COLORS.dark.on).toBe(token('[data-theme="dark"] {', "accent-contrast"));
    expect(MAP_COLORS.dark.ring).toBe(token('[data-theme="dark"] {', "paper"));
  });

  test("cluster shades start at the accent and only get deeper", () => {
    for (const theme of ["light", "dark"] as const) {
      const shades = MAP_COLORS[theme].shades;
      expect(shades[0]).toBe(MAP_COLORS[theme].accent);
      expect(new Set(shades).size).toBe(3);
      for (const shade of shades) expect(shade).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

test("both basemaps are keyless CARTO GL styles", () => {
  for (const url of Object.values(MAP_STYLES)) {
    expect(url).toMatch(/^https:\/\/basemaps\.cartocdn\.com\/gl\/[a-z-]+\/style\.json$/);
    expect(url).not.toMatch(/api[_-]?key|access[_-]?token/i);
  }
});

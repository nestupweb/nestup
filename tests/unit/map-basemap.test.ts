import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { CLUSTER_FONT, MAP_COLORS, MAP_STYLES, PLACES } from "@/components/map/basemap";

const css = readFileSync(join(import.meta.dirname, "../../app/globals.css"), "utf8");

/** Pulls one custom property out of a block of globals.css. */
function token(block: string, name: string): string {
  const start = css.indexOf(block);
  expect(start, `${block} not found in globals.css`).toBeGreaterThan(-1);
  const scope = css.slice(start, css.indexOf("}", start));
  return new RegExp(`--${name}:\s*([^;]+);`).exec(scope)?.[1].trim() ?? "";
}

function style(file: string) {
  return JSON.parse(readFileSync(join(import.meta.dirname, "../../public/maplibre", file), "utf8")) as {
    layers: { id: string; type: string; layout?: Record<string, unknown> }[];
    glyphs: string;
    sources: Record<string, { url?: string }>;
  };
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

  test("no kind of place wears the accent — that colour means 'this room'", () => {
    const kinds = Object.values(PLACES).map((p) => p.color);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const colour of kinds) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/);
      expect(colour).not.toBe(MAP_COLORS.light.accent);
      expect(colour).not.toBe(MAP_COLORS.dark.accent);
    }
  });
});

describe("basemaps", () => {
  test("are mapcn's own CARTO cartography, served by us", () => {
    // Back to Positron/Dark Matter on 2026-08-28: the OpenFreeMap swap bought
    // café labels at the cost of the map the user actually asked for. The
    // places come from app/api/places/route.ts instead.
    expect(MAP_STYLES.light).toBe("/maplibre/positron-en.json");
    expect(MAP_STYLES.dark).toBe("/maplibre/dark-matter-en.json");

    for (const file of ["positron-en.json", "dark-matter-en.json"]) {
      const source = Object.values(style(file).sources)[0]?.url ?? "";
      expect(source).toContain("basemaps.cartocdn.com");
      expect(source).not.toMatch(/api[_-]?key|access[_-]?token/i);
    }
  });

  test("label every place in English, never in Hebrew", () => {
    for (const file of ["positron-en.json", "dark-matter-en.json"]) {
      const labels = style(file).layers.filter(
        (l) => l.type === "symbol" && JSON.stringify(l.layout?.["text-field"] ?? "").includes("name")
      );
      expect(labels.length).toBeGreaterThan(20);
      for (const layer of labels) {
        // Asking for the raw `name` first is exactly the bug this replaced:
        // in Israel that field is Hebrew.
        // No `["get", "name"]` at the end on purpose: falling back to the raw
        // name is what leaves a lone Hebrew label on an English map.
        expect(layer.layout!["text-field"]).toEqual([
          "coalesce",
          ["get", "name:en"],
          ["get", "name_en"],
          ["get", "name:latin"],
        ]);
      }
    }
  });

  test("cluster counts use a font CARTO's glyph server really has", () => {
    // MapLibre draws nothing at all if the fontstack is missing, so this
    // constant has to move whenever MAP_STYLES does.
    expect(CLUSTER_FONT).toEqual(["Open Sans Semibold"]);
    for (const file of ["positron-en.json", "dark-matter-en.json"]) {
      expect(style(file).glyphs).toContain("cartocdn.com");
    }
  });
});

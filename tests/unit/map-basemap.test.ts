import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { MAP_COLORS, MAP_STYLES, NEARBY_ROOM_COLOR, PLACES } from "@/components/map/basemap";

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

  test("no kind of place wears the accent — that colour means 'this room'", () => {
    const kinds = Object.values(PLACES).map((p) => p.color);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const colour of kinds) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/);
      expect(colour).not.toBe(MAP_COLORS.light.accent);
      expect(colour).not.toBe(MAP_COLORS.dark.accent);
    }
  });

  test("a pin's card covers the pins underneath it, the room's own included", () => {
    // `.room-pin` is lifted over the place dots, which without this rule also
    // lifts it over the card a red pin opens — the green pin showing through
    // the photo was exactly that.
    const roomPin = Number(/\.room-pin\s*\{[^}]*z-index:\s*(\d+)/.exec(css)?.[1]);
    const popup = Number(/\.maplibregl-popup\s*\{[^}]*z-index:\s*(\d+)/.exec(css)?.[1]);
    expect(roomPin).toBeGreaterThan(0);
    expect(popup).toBeGreaterThan(roomPin);
  });

  test("the rooms nearby are their own red — not the accent, not a restaurant", () => {
    // On a room's map the accent means "the room you're looking at" and this
    // red means "one you could look at instead". A restaurant sharing either
    // hex would undo the whole point of colouring them.
    expect(NEARBY_ROOM_COLOR).toMatch(/^#[0-9a-f]{6}$/);
    expect(NEARBY_ROOM_COLOR).not.toBe(MAP_COLORS.light.accent);
    expect(NEARBY_ROOM_COLOR).not.toBe(MAP_COLORS.dark.accent);
    for (const { color } of Object.values(PLACES)) {
      expect(color).not.toBe(NEARBY_ROOM_COLOR);
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
        // `name:en` alone. Every wider net puts the Hebrew back: `name` is
        // the local name, and both `name_en` and `name:latin` are defined to
        // fall back to it when there's no English. See the note on
        // ENGLISH_LABEL in scripts/build-english-basemaps.mjs.
        expect(layer.layout!["text-field"]).toEqual(["get", "name:en"]);
      }
    }
  });

  test("are served by CARTO's own glyphs and sprites", () => {
    for (const file of ["positron-en.json", "dark-matter-en.json"]) {
      expect(style(file).glyphs).toContain("cartocdn.com");
    }
  });
});

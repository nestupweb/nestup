import { describe, expect, test } from "vitest";
import {
  APPROX_RADIUS_M,
  boundsOf,
  circlePolygon,
  distanceM,
  hashUnit,
  pointOf,
  scatter,
  shouldGeocode,
  visiblePoint,
} from "@/lib/geo";
import { locationNote } from "@/lib/location";
import { nearCity, parseNominatim } from "@/lib/geocode";

const TLV = { lat: 32.0853, lng: 34.7818 };

describe("hashUnit", () => {
  test("is deterministic and stays inside 0…1", () => {
    expect(hashUnit("abc")).toBe(hashUnit("abc"));
    expect(hashUnit("abc")).not.toBe(hashUnit("abd"));
    for (const key of ["", "a", "listing-42", "ז", "🙂"]) {
      const v = hashUnit(key);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("scatter", () => {
  test("stays within the radius and never moves for the same key", () => {
    for (let i = 0; i < 200; i++) {
      const p = scatter(TLV, `room-${i}`, 150);
      expect(distanceM(TLV, p)).toBeLessThanOrEqual(151);
    }
    expect(scatter(TLV, "room-1", 150)).toEqual(scatter(TLV, "room-1", 150));
  });

  test("different keys land in different places", () => {
    const a = scatter(TLV, "a", 500);
    const b = scatter(TLV, "b", 500);
    expect(a).not.toEqual(b);
    expect(distanceM(a, b)).toBeGreaterThan(0);
  });

  test("spreads outward rather than bunching in the middle", () => {
    // sqrt on the radius gives an even area distribution: with a uniform
    // spread, half the points fall beyond ~70% of the radius.
    const far = Array.from({ length: 400 }, (_, i) => scatter(TLV, `k${i}`, 1000)).filter(
      (p) => distanceM(TLV, p) > 700
    );
    expect(far.length).toBeGreaterThan(120);
  });
});

describe("visiblePoint", () => {
  const listing = { id: "abc-123", lat: TLV.lat, lng: TLV.lng, coords_source: "geocoded" as const };

  test("blurs the address for everyone who isn't in the conversation", () => {
    const shown = visiblePoint(listing, false);
    expect(shown?.exact).toBe(false);
    expect(shown?.point).not.toEqual(TLV);
    expect(distanceM(TLV, shown!.point)).toBeLessThanOrEqual(APPROX_RADIUS_M);
    // stable between renders — the room must not appear to wander
    expect(visiblePoint(listing, false)).toEqual(shown);
  });

  test("gives the real point to someone allowed to see it", () => {
    const shown = visiblePoint(listing, true);
    expect(shown).toEqual({ point: TLV, exact: true });
  });

  test("never claims a city-centre fallback is exact", () => {
    const vague = { ...listing, coords_source: "city" as const };
    expect(visiblePoint(vague, true)?.exact).toBe(false);
  });

  test("no coordinates means no map", () => {
    expect(visiblePoint({ ...listing, lat: null, lng: null }, true)).toBeNull();
    expect(pointOf({ lat: null, lng: 3 })).toBeNull();
    expect(pointOf({ lat: 1, lng: 2 })).toEqual({ lat: 1, lng: 2 });
  });

  test("two rooms at the same address get different blurred points", () => {
    const other = { ...listing, id: "def-456" };
    expect(visiblePoint(listing, false)?.point).not.toEqual(visiblePoint(other, false)?.point);
  });
});

describe("shouldGeocode", () => {
  test("an owner's own pin is never overwritten", () => {
    expect(shouldGeocode("owner", true)).toBe(false);
    expect(shouldGeocode("owner", false)).toBe(false);
  });

  test("looks up a new address, a missing point, or a city-level fallback", () => {
    expect(shouldGeocode("none", false)).toBe(true);
    expect(shouldGeocode("city", false)).toBe(true);
    expect(shouldGeocode("geocoded", true)).toBe(true);
    expect(shouldGeocode("geocoded", false)).toBe(false); // nothing changed
  });
});

describe("boundsOf", () => {
  test("wraps the points with a little padding", () => {
    const b = boundsOf([{ lat: 32, lng: 34 }, { lat: 33, lng: 35 }], 0.01)!;
    expect(b.south).toBeCloseTo(31.99);
    expect(b.north).toBeCloseTo(33.01);
    expect(b.west).toBeCloseTo(33.99);
    expect(b.east).toBeCloseTo(35.01);
  });

  test("nothing to wrap", () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe("distanceM", () => {
  test("measures real distances", () => {
    expect(distanceM(TLV, TLV)).toBe(0);
    // Tel Aviv → Jerusalem is about 54 km
    const d = distanceM(TLV, { lat: 31.7683, lng: 35.2137 });
    expect(d).toBeGreaterThan(50_000);
    expect(d).toBeLessThan(60_000);
  });
});

describe("geocode helpers", () => {
  test("parses a Nominatim hit and rejects nonsense", () => {
    expect(parseNominatim([{ lat: "32.1", lon: "34.8" }])).toEqual({ lat: 32.1, lng: 34.8 });
    expect(parseNominatim([])).toBeNull();
    expect(parseNominatim(null)).toBeNull();
    expect(parseNominatim([{ lat: "banana", lon: "34.8" }])).toBeNull();
    expect(parseNominatim([{ lat: "132", lon: "34.8" }])).toBeNull();
  });

  test("a hit from the wrong end of the country is refused", () => {
    expect(nearCity({ lat: 32.08, lng: 34.78 }, "Tel Aviv")).toBe(true);
    expect(nearCity({ lat: 29.55, lng: 34.95 }, "Tel Aviv")).toBe(false); // Eilat
    expect(nearCity({ lat: 29.55, lng: 34.95 }, "Nowhere")).toBe(true); // unknown city: no check
  });
});

describe("locationNote", () => {
  const base = { city: "Tel Aviv", street: "Florentin", neighborhood: "Florentin", coords_source: "geocoded" as const };

  test("says plainly how precise the dot is", () => {
    expect(locationNote(base, false)).toMatch(/approximate area/i);
    expect(locationNote(base, true)).toMatch(/Florentin/);
    expect(locationNote({ ...base, coords_source: "city" }, true)).toMatch(/Somewhere in Tel Aviv/i);
    // a city-level room never claims a street address, even to the owner
    expect(locationNote({ ...base, coords_source: "city" }, true)).not.toMatch(/Exact location/i);
  });
});

describe("circlePolygon", () => {
  const centre = { lat: 32.0853, lng: 34.7818 };

  test("closes, and every vertex sits the asked-for distance away", () => {
    const ring = circlePolygon(centre, APPROX_RADIUS_M).geometry.coordinates[0];
    expect(ring).toHaveLength(65); // 64 steps + the repeat that closes it
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lng, lat] of ring) {
      expect(distanceM(centre, { lat, lng })).toBeGreaterThanOrEqual(APPROX_RADIUS_M - 2);
      expect(distanceM(centre, { lat, lng })).toBeLessThanOrEqual(APPROX_RADIUS_M + 2);
    }
  });

  test("is drawn in real coordinates, so it doesn't change size with the zoom", () => {
    const small = circlePolygon(centre, 150).geometry.coordinates[0];
    const big = circlePolygon(centre, 300).geometry.coordinates[0];
    expect(distanceM(centre, { lat: big[0][1], lng: big[0][0] })).toBeCloseTo(
      2 * distanceM(centre, { lat: small[0][1], lng: small[0][0] }),
      -1
    );
  });
});

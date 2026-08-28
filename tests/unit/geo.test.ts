import { describe, expect, test } from "vitest";
import { boundsOf, distanceM, hashUnit, pointOf, scatter, shouldGeocode } from "@/lib/geo";
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

describe("pointOf", () => {
  test("gives the room its own point, and nothing when it has none", () => {
    // No blurring any more (user decision, 2026-08-28): the pin is the address.
    expect(pointOf({ lat: TLV.lat, lng: TLV.lng })).toEqual(TLV);
    expect(pointOf({ lat: null, lng: 3 })).toBeNull();
    expect(pointOf({ lat: 1, lng: null })).toBeNull();
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
  const base = {
    city: "Tel Aviv",
    street: "Florentin",
    house_number: "54",
    address: "Florentin 54",
    neighborhood: "Florentin",
    coords_source: "geocoded" as const,
  };

  test("names the address the pin sits on, without saying Florentin twice", () => {
    expect(locationNote(base)).toBe("Florentin 54, Tel Aviv.");
    expect(locationNote({ ...base, neighborhood: "Kerem HaTeimanim" })).toBe(
      "Florentin 54, Kerem HaTeimanim, Tel Aviv."
    );
    // Seed rooms keep the whole address in one column and leave the split ones empty.
    expect(locationNote({ ...base, street: "", house_number: "", neighborhood: "" })).toBe(
      "Florentin 54, Tel Aviv."
    );
    expect(locationNote({ ...base, street: "", house_number: "", address: "", neighborhood: "" })).toBe("Tel Aviv.");
  });

  test("owns up when the address couldn't be placed", () => {
    const vague = locationNote({ ...base, coords_source: "city" });
    expect(vague).toMatch(/approximate/i);
    expect(vague).toMatch(/Tel Aviv/);
    expect(vague).not.toMatch(/Florentin 54/);
  });
});

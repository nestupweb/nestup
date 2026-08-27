import { describe, expect, test } from "vitest";
import { CITY_CENTRES, ISRAEL_CENTRE } from "@/lib/city-centres";
import { CITIES } from "@/lib/constants";
import { distanceM } from "@/lib/geo";

/** Generous box around the country — a point outside it is a geocoding miss. */
const BOX = { minLat: 29.4, maxLat: 33.4, minLng: 34.2, maxLng: 35.95 };

describe("city centres", () => {
  test("every city in the picker has a centre, and no strays", () => {
    for (const city of CITIES) {
      expect(CITY_CENTRES[city], `${city} has no centre`).toBeDefined();
    }
    for (const city of Object.keys(CITY_CENTRES)) {
      expect(CITIES, `${city} is not in the city list`).toContain(city);
    }
    expect(Object.keys(CITY_CENTRES)).toHaveLength(CITIES.length);
  });

  test("every centre is inside the country", () => {
    for (const [city, p] of Object.entries(CITY_CENTRES)) {
      expect(p.lat, `${city} latitude`).toBeGreaterThanOrEqual(BOX.minLat);
      expect(p.lat, `${city} latitude`).toBeLessThanOrEqual(BOX.maxLat);
      expect(p.lng, `${city} longitude`).toBeGreaterThanOrEqual(BOX.minLng);
      expect(p.lng, `${city} longitude`).toBeLessThanOrEqual(BOX.maxLng);
    }
  });

  test("no two cities share a point", () => {
    // Nominatim answered several West Bank towns with a *different* town's
    // coordinates (Givat Ze'ev came back as Kiryat Shmona). Duplicates are the
    // fingerprint of that failure, so they stay banned.
    const seen = new Map<string, string>();
    for (const [city, p] of Object.entries(CITY_CENTRES)) {
      const key = `${p.lat},${p.lng}`;
      expect(seen.get(key), `${city} shares a point with ${seen.get(key)}`).toBeUndefined();
      seen.set(key, city);
    }
  });

  test("the hand-pinned places sit where they belong", () => {
    // Spot checks against known positions, ~5 km tolerance.
    const expected: Record<string, { lat: number; lng: number }> = {
      Ariel: { lat: 32.1056, lng: 35.1739 },
      Efrat: { lat: 31.6539, lng: 35.1519 },
      "Kiryat Arba": { lat: 31.5236, lng: 35.1119 },
      "Ma'ale Adumim": { lat: 31.7725, lng: 35.2981 },
      "Givat Ze'ev": { lat: 31.8611, lng: 35.1683 },
      "Modi'in Illit": { lat: 31.9319, lng: 35.0417 },
    };
    for (const [city, point] of Object.entries(expected)) {
      expect(distanceM(CITY_CENTRES[city], point), `${city}`).toBeLessThan(5000);
    }
  });

  test("well-known cities are where everyone expects them", () => {
    expect(distanceM(CITY_CENTRES["Tel Aviv"], { lat: 32.0853, lng: 34.7818 })).toBeLessThan(3000);
    expect(distanceM(CITY_CENTRES.Jerusalem, { lat: 31.7683, lng: 35.2137 })).toBeLessThan(3000);
    expect(distanceM(CITY_CENTRES.Haifa, { lat: 32.794, lng: 34.9896 })).toBeLessThan(5000);
    expect(distanceM(CITY_CENTRES.Eilat, { lat: 29.5577, lng: 34.9519 })).toBeLessThan(5000);
    expect(distanceM(CITY_CENTRES["Abu Ghosh"], { lat: 31.8056, lng: 35.1097 })).toBeLessThan(3000);
  });

  test("the country centre is inside the box", () => {
    expect(ISRAEL_CENTRE.lat).toBeGreaterThan(BOX.minLat);
    expect(ISRAEL_CENTRE.lat).toBeLessThan(BOX.maxLat);
  });
});

import { afterEach, describe, expect, test, vi } from "vitest";
import { boundsOf, distanceM, hashUnit, pointOf, shouldGeocode } from "@/lib/geo";
import { locationNote } from "@/lib/location";
import { geocodeAddress, nearCity, parseNominatim } from "@/lib/geocode";

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

  test("never hedges — a room is either at its address or has no map", () => {
    // The "approximate, city centre" wording went with the city-centre
    // fallback itself (2026-08-28). Nothing should say the pin is a guess,
    // because a guessed pin can no longer be stored.
    expect(locationNote(base)).not.toMatch(/approximate|roughly|near/i);
  });
});

describe("geocodeAddress", () => {
  const ADDRESS = { street: "Florentin", house_number: "54", city: "Tel Aviv" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function answers(body: unknown, ok = true) {
    const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  test("a real address comes back as a point", async () => {
    answers([{ lat: "32.0578", lon: "34.7686" }]);
    await expect(geocodeAddress(ADDRESS)).resolves.toEqual({
      status: "found",
      lat: 32.0578,
      lng: 34.7686,
    });
  });

  test("an address that doesn't exist is 'missing', never the city centre", async () => {
    // The old version answered with the middle of Tel Aviv and called it
    // approximate. Now the save is refused: no room is published at an
    // address that does not exist.
    answers([]);
    await expect(geocodeAddress(ADDRESS)).resolves.toEqual({ status: "missing" });
  });

  test("a hit in the wrong city is 'missing' too", async () => {
    answers([{ lat: "29.5569", lon: "34.9498" }]); // Eilat, ~300 km away
    await expect(geocodeAddress(ADDRESS)).resolves.toEqual({ status: "missing" });
  });

  test("a geocoder that won't answer is told apart from one that says no", async () => {
    // This distinction is the whole point: an outage must not cost the owner
    // their listing, but a wrong address must not be saved as if it were right.
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodeAddress(ADDRESS)).resolves.toEqual({ status: "unavailable" });
  });

  /**
   * The distinction the whole feature rests on: a listing is refused when its
   * address is fake, so "fake" must never mean "the server was busy".
   */
  test("a 503 is 'unavailable', not 'there is no such address'", async () => {
    answers([], false);
    await expect(geocodeAddress(ADDRESS)).resolves.toEqual({ status: "unavailable" });
  });

  test("one failed attempt is retried before giving up", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ ok: true, json: async () => [{ lat: "32.0578", lon: "34.7686" }] });
    vi.stubGlobal("fetch", fetchMock);

    await expect(geocodeAddress(ADDRESS)).resolves.toEqual({ status: "found", lat: 32.0578, lng: 34.7686 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("an empty answer is not retried — it is an answer", async () => {
    const fetchMock = answers([]);
    await expect(geocodeAddress(ADDRESS)).resolves.toEqual({ status: "missing" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("asks once, for the full address only", async () => {
    // The street alone used to be a second try, which returned a point
    // somewhere along the street and got nudged to stop rooms stacking.
    const fetchMock = answers([{ lat: "32.0578", lon: "34.7686" }]);
    await geocodeAddress(ADDRESS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("Florentin+54");
  });
});

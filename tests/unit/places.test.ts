import { describe, expect, test } from "vitest";
import { MAX_PLACES, PLACE_RADIUS_M, placesQuery, readPlaces } from "@/lib/places";

const ROOM = { lat: 32.0578, lng: 34.7686 };

/** One Overpass element, with only the bits the reader looks at. */
function element(tags: Record<string, string>, lat = 32.058, lon = 34.769, id = 1) {
  return { type: "node", id, lat, lon, tags };
}

describe("placesQuery", () => {
  test("asks for the four kinds, around the room, in JSON", () => {
    const q = placesQuery(ROOM.lat, ROOM.lng);
    expect(q).toContain("[out:json]");
    expect(q).toContain(`around:${PLACE_RADIUS_M},${ROOM.lat},${ROOM.lng}`);
    for (const amenity of ["cafe", "restaurant", "fast_food", "bar", "pub"]) {
      expect(q).toContain(amenity);
    }
    expect(q).toContain('["shop"]');
    // `nwr` and `out center`: a café can be a point, a building outline or a
    // relation, and all three have to come back with one coordinate.
    expect(q).toContain("nwr(");
    expect(q).toContain("out center");
  });
});

describe("readPlaces", () => {
  test("sorts the four kinds, nearest first", () => {
    const places = readPlaces(
      {
        elements: [
          element({ amenity: "restaurant", name: "Far Grill" }, 32.062, 34.774, 1),
          element({ amenity: "cafe", "name:en": "Near Coffee" }, 32.0579, 34.7687, 2),
          element({ shop: "bakery", name: "Bread" }, 32.059, 34.77, 3),
          element({ amenity: "pub", name: "The Pub" }, 32.0605, 34.772, 4),
        ],
      },
      ROOM
    );

    expect(places.map((p) => p.name)).toEqual(["Near Coffee", "Bread", "The Pub", "Far Grill"]);
    expect(places.map((p) => p.kind)).toEqual(["cafe", "shop", "bar", "restaurant"]);
  });

  test("never returns a Hebrew name — the map is in English", () => {
    const places = readPlaces(
      {
        elements: [
          element({ amenity: "cafe", name: "קפה לנדוור" }, 32.058, 34.769, 1),
          element({ amenity: "cafe", name: "קפה", "name:en": "Cafe Landwer" }, 32.0581, 34.7691, 2),
        ],
      },
      ROOM
    );

    // The unnamed one keeps its pin — the user asked for the Hebrew to go, not
    // for the café to go — and is labelled by what it is.
    expect(places.map((p) => p.name)).toEqual(["Café", "Cafe Landwer"]);
    for (const place of places) expect(place.name).not.toMatch(/[֐-ࣿ]/);
  });

  test("skips anything that isn't one of the four kinds, and shops that closed", () => {
    const places = readPlaces(
      {
        elements: [
          element({ amenity: "parking" }, 32.058, 34.769, 1),
          element({ shop: "vacant" }, 32.058, 34.769, 2),
          element({ shop: "no" }, 32.058, 34.769, 3),
          element({ highway: "bus_stop", name: "Stop" }, 32.058, 34.769, 4),
          element({ amenity: "bar", name: "Real Bar" }, 32.058, 34.769, 5),
        ],
      },
      ROOM
    );
    expect(places.map((p) => p.name)).toEqual(["Real Bar"]);
  });

  test("reads a café mapped as a building, not a point", () => {
    const places = readPlaces(
      {
        elements: [
          { type: "way", id: 9, center: { lat: 32.0579, lon: 34.7687 }, tags: { amenity: "cafe", name: "Wayfarer" } },
        ],
      },
      ROOM
    );
    expect(places).toEqual([{ id: "way/9", name: "Wayfarer", kind: "cafe", lat: 32.0579, lng: 34.7687 }]);
  });

  test("caps how many pins a busy street can produce", () => {
    const elements = Array.from({ length: MAX_PLACES + 25 }, (_, i) =>
      element({ amenity: "cafe", name: `Cafe ${i}` }, 32.058 + i / 100_000, 34.769, i)
    );
    expect(readPlaces({ elements }, ROOM)).toHaveLength(MAX_PLACES);
  });

  test("survives whatever a public mirror hands back", () => {
    // This runs on the answer of a volunteer service that is sometimes an
    // error page. None of these may throw.
    expect(readPlaces(null, ROOM)).toEqual([]);
    expect(readPlaces({}, ROOM)).toEqual([]);
    expect(readPlaces({ elements: "nope" }, ROOM)).toEqual([]);
    expect(readPlaces({ elements: [{}, { tags: {} }, { tags: { amenity: "cafe" } }] }, ROOM)).toEqual([]);
  });
});

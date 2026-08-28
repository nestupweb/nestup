import { beforeEach, describe, expect, test, vi } from "vitest";

type Call = [string, ...unknown[]];
const calls: Call[] = [];
let rows: unknown[] = [];
let failure: unknown = null;

// One chainable recorder standing in for the query builder: every filter the
// query applies lands in `calls`, and awaiting it yields the rows.
function builder() {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "is", "not", "gte", "lte", "limit"]) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return q;
    };
  }
  q.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: failure });
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => (calls.push(["from", table]), builder()) }),
}));

const { queryNearbyListingPins, MAX_NEARBY_PINS, NEARBY_RADIUS_M } = await import("@/lib/listings");

const HERE = { lat: 32.0578, lng: 34.7686 };

beforeEach(() => {
  calls.length = 0;
  failure = null;
  rows = [];
});

describe("queryNearbyListingPins", () => {
  test("asks for live, placed rooms around the point — never the room itself", async () => {
    await queryNearbyListingPins(HERE, "this-room");

    expect(calls).toContainEqual(["from", "listings"]);
    expect(calls).toContainEqual(["eq", "is_active", true]);
    expect(calls).toContainEqual(["is", "removed_at", null]);
    expect(calls).toContainEqual(["neq", "id", "this-room"]);
    // The same exclusion the map of every room makes: a room pinned at the
    // middle of its city isn't at its address, so it isn't on a map.
    expect(calls).toContainEqual(["neq", "coords_source", "city"]);
    expect(calls).toContainEqual(["limit", MAX_NEARBY_PINS]);
  });

  test("boxes the search to the radius, wider in longitude than in latitude", async () => {
    await queryNearbyListingPins(HERE, "this-room");

    const bound = (m: string, col: string) =>
      calls.find(([method, c]) => method === m && c === col)?.[2] as number;
    const latSpan = bound("lte", "lat") - bound("gte", "lat");
    const lngSpan = bound("lte", "lng") - bound("gte", "lng");

    expect(latSpan / 2).toBeCloseTo(NEARBY_RADIUS_M / 111_320, 5);
    // A degree of longitude is shorter this far north, so covering the same
    // distance takes more of them.
    expect(lngSpan).toBeGreaterThan(latSpan);
    expect(bound("gte", "lat")).toBeLessThan(HERE.lat);
    expect(bound("lte", "lat")).toBeGreaterThan(HERE.lat);
  });

  test("turns rows into pins and drops any that lost their position", async () => {
    rows = [
      { id: "a", lat: 32.06, lng: 34.77, rent: 3200, title: "Room", city: "Tel Aviv", neighborhood: "Florentin", photo_urls: ["p.jpg", "q.jpg"] },
      { id: "b", lat: null, lng: null, rent: 2900, title: "Room", city: "Tel Aviv", neighborhood: "", photo_urls: null },
    ];

    const pins = await queryNearbyListingPins(HERE, "this-room");

    expect(pins).toEqual([
      { id: "a", lat: 32.06, lng: 34.77, rent: 3200, title: "Room", city: "Tel Aviv", neighborhood: "Florentin", photo: "p.jpg" },
    ]);
  });

  test("a failed query costs the alternatives, not the map", async () => {
    failure = { message: "nope" };
    expect(await queryNearbyListingPins(HERE, "this-room")).toEqual([]);
  });
});

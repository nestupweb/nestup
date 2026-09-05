// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The two public Route Handlers behind the room list: `GET /api/listings` and
 * `GET /api/listings/pins`.
 *
 * `listing-query.test.ts` covers the translation from filters into PostgREST
 * calls, and `validation.test.ts` covers the schema. This covers the seam
 * between them — the part a caller actually touches:
 *
 *  - a raw query string becomes filters, and the answer says which page it is;
 *  - **junk never becomes a 500.** Every field on `listingFiltersSchema`
 *    carries `.catch()`, and `parse` (not `safeParse`) is called on the
 *    strength of that. A field added without a `.catch()` would turn a stray
 *    `?rent_max=banana` — the shape a bookmarked or hand-edited URL takes —
 *    into a thrown request, and this is the test that says so;
 *  - the pins endpoint answers with something the CDN may keep, because it is
 *    fetched on every first open of the map.
 *
 * Both handlers are anonymous by design: Listings is public, and RLS on the
 * cookie-free client is what decides that only active rooms come back.
 */

const queryListings = vi.fn();
const queryAllListingPins = vi.fn();

vi.mock("@/lib/listings", () => ({ queryListings, queryAllListingPins }));

const ROOM = {
  id: "22222222-2222-4222-8222-222222222222",
  city: "Haifa",
  rent: 2800,
};

beforeEach(() => {
  queryListings.mockReset().mockResolvedValue({ listings: [ROOM], total: 1 });
  queryAllListingPins.mockReset().mockResolvedValue([
    { id: ROOM.id, lat: 32.08, lng: 34.78, rent: 2800, title: "Sunlit room", city: "Tel Aviv", neighborhood: "Florentin", photo: null },
  ]);
});

async function get(query: string) {
  const { NextRequest } = await import("next/server");
  const { GET } = await import("@/app/api/listings/route");
  const response = await GET(new NextRequest(`http://localhost:3000/api/listings${query}`));
  return { response, body: await response.json() };
}

/** The filters the handler resolved out of the query string. */
function filters(): Record<string, unknown> {
  expect(queryListings).toHaveBeenCalledTimes(1);
  return queryListings.mock.calls[0][0] as Record<string, unknown>;
}

describe("GET /api/listings", () => {
  test("a query string becomes filters, and the answer says which page it is", async () => {
    const { response, body } = await get("?city=Haifa&rent_max=3000&page=2&page_size=5&sort=price_asc");

    expect(response.status).toBe(200);
    expect(filters()).toMatchObject({
      city: "Haifa",
      rent_max: 3000,
      page: 2,
      page_size: 5,
      sort: "price_asc",
    });
    expect(body).toEqual({ listings: [ROOM], total: 1, page: 2, page_size: 5 });
  });

  test("an empty query string is a valid request for the first page", async () => {
    const { response, body } = await get("");

    expect(response.status).toBe(200);
    expect(filters()).toMatchObject({ sort: "newest", page: 1, page_size: 20 });
    expect(body.page).toBe(1);
  });

  test.each([
    ["rent that isn't a number", "?rent_max=banana", { rent_max: undefined }],
    ["a page before the first", "?page=-5", { page: 1 }],
    ["a page size nobody would serve", "?page_size=9999", { page_size: 20 }],
    ["an ordering that doesn't exist", "?sort=cheapest", { sort: "newest" }],
    ["a city we don't cover", "?city=Paris", { city: undefined }],
    ["a move-in date that never happened", "?move_in_by=2026-13-45", { move_in_by: undefined }],
    ["a lease term nobody offers", "?lease_term=forever", { lease_term: undefined }],
    ["a retired household-gender value from an old link", "?household_gender=any", { household_gender: undefined }],
  ])("%s falls back to the default instead of failing the request", async (_label, query, expected) => {
    const { response } = await get(query);

    expect(response.status).toBe(200);
    expect(filters()).toMatchObject(expected);
  });

  test("every junk parameter at once is still one perfectly ordinary first page", async () => {
    const { response } = await get("?city=Atlantis&rent_min=-&rent_max=NaN&page=abc&page_size=0&sort=%00&pets_allowed=maybe");

    expect(response.status).toBe(200);
    expect(filters()).toMatchObject({
      city: undefined,
      rent_max: undefined,
      page: 1,
      page_size: 20,
      sort: "newest",
      // A tick is `true`; anything that is not "true"/"false" is not a filter
      // at all, which is what keeps an unticked box out of the query.
      pets_allowed: undefined,
    });
  });

  test("a ticked amenity is a real filter, and one nobody touched is absent rather than false", async () => {
    await get("?balcony=true&parking=false");
    const parsed = filters();

    expect(parsed).toMatchObject({ balcony: true, parking: false });
    // Absent, not `false`: an amenity nobody filtered on must add no `eq` at
    // all, or every search would silently demand a room with no lift.
    expect(parsed.elevator).toBeUndefined();
  });
});

describe("GET /api/listings/pins", () => {
  test("the map's pins come back with their own count", async () => {
    const { GET } = await import("@/app/api/listings/pins/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.pins).toHaveLength(1);
    expect(body.pins[0]).toMatchObject({ id: ROOM.id, lat: 32.08, lng: 34.78 });
  });

  /**
   * Fetched on the first open of the map on every visit, and the answer only
   * changes when somebody lists a room — so it must be cacheable, or the
   * volunteer-scale Overpass-style load lands on our own database instead.
   */
  test("the answer is one the CDN is allowed to keep for a while", async () => {
    const { GET } = await import("@/app/api/listings/pins/route");
    const cacheControl = (await GET()).headers.get("cache-control") ?? "";

    expect(cacheControl).toMatch(/public/);
    expect(cacheControl).toMatch(/s-maxage=\d+/);
    expect(cacheControl).not.toMatch(/no-store/);
  });

  test("a failed lookup is an empty map, never a broken response", async () => {
    queryAllListingPins.mockResolvedValue([]);
    const { GET } = await import("@/app/api/listings/pins/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pins: [], total: 0 });
  });
});

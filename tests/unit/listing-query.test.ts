import { describe, expect, test } from "vitest";
import { applyListingFilters } from "@/lib/listings";
import { listingFiltersSchema } from "@/lib/validation/filters";

type Call = [string, ...unknown[]];

function fakeQuery() {
  const calls: Call[] = [];
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["eq", "gte", "lte", "order", "range"]) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return q;
    };
  }
  return { q: q as never, calls };
}

describe("applyListingFilters", () => {
  test("translates filters into supabase calls with pagination", () => {
    const { q, calls } = fakeQuery();
    const filters = listingFiltersSchema.parse({
      city: "Tel Aviv", rent_min: "2000", rent_max: "3500",
      pets_allowed: "true", balcony: "true", page: "2", page_size: "10",
    });
    applyListingFilters(q, filters);
    expect(calls).toContainEqual(["eq", "city", "Tel Aviv"]);
    expect(calls).toContainEqual(["gte", "rent", 2000]);
    expect(calls).toContainEqual(["lte", "rent", 3500]);
    expect(calls).toContainEqual(["eq", "pets_allowed", true]);
    expect(calls).toContainEqual(["eq", "balcony", true]);
    expect(calls).toContainEqual(["range", 10, 19]); // page 2, size 10
  });

  test("'for how long' filters on the exact lease term and drops junk values", () => {
    const { q, calls } = fakeQuery();
    applyListingFilters(q, listingFiltersSchema.parse({ lease_term: "half_year" }));
    expect(calls).toContainEqual(["eq", "lease_term", "half_year"]);
    expect(listingFiltersSchema.parse({ lease_term: "forever" }).lease_term).toBeUndefined();
    expect(listingFiltersSchema.parse({ lease_term: "" }).lease_term).toBeUndefined();
    const none = fakeQuery();
    applyListingFilters(none.q, listingFiltersSchema.parse({ lease_term: "" }));
    expect(none.calls.some(([m, col]) => m === "eq" && col === "lease_term")).toBe(false);
  });

  test("omitted filters add no calls besides order/range", () => {
    const { q, calls } = fakeQuery();
    applyListingFilters(q, listingFiltersSchema.parse({}));
    const filterCalls = calls.filter(([m]) => m !== "order" && m !== "range");
    expect(filterCalls).toHaveLength(0);
  });
});

describe("sort", () => {
  test("defaults to newest, orders by rent when asked, and rejects junk", () => {
    expect(listingFiltersSchema.parse({}).sort).toBe("newest");
    expect(listingFiltersSchema.parse({ sort: "nonsense" }).sort).toBe("newest");
    const { q, calls } = fakeQuery();
    applyListingFilters(q, listingFiltersSchema.parse({ sort: "price_desc" }));
    expect(calls[0]).toEqual(["order", "rent", { ascending: false }]);
    const cheap = fakeQuery();
    applyListingFilters(cheap.q, listingFiltersSchema.parse({ sort: "price_asc" }));
    expect(cheap.calls[0]).toEqual(["order", "rent", { ascending: true }]);
    const newest = fakeQuery();
    applyListingFilters(newest.q, listingFiltersSchema.parse({}));
    expect(newest.calls.filter(([m]) => m === "order")).toEqual([["order", "created_at", { ascending: false }]]);
  });
});

describe("view", () => {
  test("defaults to the list and refuses anything it doesn't know", () => {
    expect(listingFiltersSchema.parse({}).view).toBe("list");
    expect(listingFiltersSchema.parse({ view: "map" }).view).toBe("map");
    expect(listingFiltersSchema.parse({ view: "globe" }).view).toBe("list");
  });

  test("the map query asks for every match, not one page", () => {
    const { q, calls } = fakeQuery();
    applyListingFilters(q, listingFiltersSchema.parse({ page: "3", city: "Haifa" }), { paginate: false });
    expect(calls.some(([m]) => m === "range")).toBe(false);
    expect(calls).toContainEqual(["eq", "city", "Haifa"]); // filters still apply
    const paged = fakeQuery();
    applyListingFilters(paged.q, listingFiltersSchema.parse({ page: "3" }));
    expect(paged.calls).toContainEqual(["range", 40, 59]);
  });
});

import { describe, expect, test } from "vitest";
import { applyListingFilters } from "@/lib/listings";
import { listingFiltersSchema } from "@/lib/validation/filters";

type Call = [string, ...unknown[]];

function fakeQuery() {
  const calls: Call[] = [];
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["eq", "neq", "gte", "lte", "order", "range"]) {
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

  test("mamad: 'has one' is anywhere in the building, the rest are that exact place", () => {
    const any = fakeQuery();
    applyListingFilters(any.q, listingFiltersSchema.parse({ safe_room: "has" }));
    expect(any.calls).toContainEqual(["neq", "safe_room", "none"]);

    const flat = fakeQuery();
    applyListingFilters(flat.q, listingFiltersSchema.parse({ safe_room: "apartment" }));
    expect(flat.calls).toContainEqual(["eq", "safe_room", "apartment"]);

    // Nothing chosen, and nothing asked of the query.
    const none = fakeQuery();
    applyListingFilters(none.q, listingFiltersSchema.parse({}));
    expect(none.calls.some(([, col]) => col === "safe_room")).toBe(false);

    // "none" is a listing's answer, not a search: nobody looks for no mamad.
    expect(listingFiltersSchema.parse({ safe_room: "none" }).safe_room).toBeUndefined();
    expect(listingFiltersSchema.parse({ safe_room: "" }).safe_room).toBeUndefined();
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

import { describe, expect, test } from "vitest";
import { applyListingFilters } from "@/lib/listings";
import { listingFiltersSchema } from "@/lib/validation/filters";

type Call = [string, ...unknown[]];

function fakeQuery() {
  const calls: Call[] = [];
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ["eq", "gte", "lte", "not", "order", "range"]) {
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

  test("mamad: the two places, and nothing else", () => {
    for (const where of ["apartment", "building"] as const) {
      const q = fakeQuery();
      applyListingFilters(q.q, listingFiltersSchema.parse({ safe_room: where }));
      expect(q.calls).toContainEqual(["eq", "safe_room", where]);
    }

    // Nothing chosen, and nothing asked of the query.
    const none = fakeQuery();
    applyListingFilters(none.q, listingFiltersSchema.parse({}));
    expect(none.calls.some(([, col]) => col === "safe_room")).toBe(false);

    // "none" is a listing's answer, not a search; "has" was dropped, and an
    // old link carrying it falls back to no filter rather than erroring.
    for (const junk of ["none", "has", ""]) {
      expect(listingFiltersSchema.parse({ safe_room: junk }).safe_room).toBeUndefined();
    }
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

/**
 * "All roommates of the same gender" (0037). The listing carries the answer in
 * `household_gender`, which is null when the household is mixed OR when one of
 * them has not said — so neither can slip through a filter that asks for one.
 */
describe("the same-gender filter", () => {
  test("a chosen gender becomes one equality on the derived column", () => {
    const { q, calls } = fakeQuery();
    applyListingFilters(q, listingFiltersSchema.parse({ household_gender: "female" }));
    expect(calls).toContainEqual(["eq", "household_gender", "female"]);
  });

  /**
   * The filter offers male and female and nothing else (user decision,
   * 2026-09-01). The three it used to carry — `any`, `other` and
   * `prefer_not_to_say` — are now unparseable, and a bookmarked link holding
   * one has to degrade to "no filter" rather than 500 or return nothing.
   */
  test.each(["any", "other", "prefer_not_to_say"])(
    "a retired option (%s) leaves the room list unfiltered",
    (retired) => {
      const { q, calls } = fakeQuery();
      applyListingFilters(q, listingFiltersSchema.parse({ household_gender: retired }));
      expect(calls.some((c) => c[1] === "household_gender")).toBe(false);
    }
  );

  test("male is the other half of it", () => {
    const { q, calls } = fakeQuery();
    applyListingFilters(q, listingFiltersSchema.parse({ household_gender: "male" }));
    expect(calls).toContainEqual(["eq", "household_gender", "male"]);
  });

  test("unticked filters nothing, and junk is ignored rather than throwing", () => {
    const off = fakeQuery();
    applyListingFilters(off.q, listingFiltersSchema.parse({}));
    expect(off.calls.some((c) => c[1] === "household_gender")).toBe(false);

    const junk = fakeQuery();
    applyListingFilters(junk.q, listingFiltersSchema.parse({ household_gender: "sideways" }));
    expect(junk.calls.some((c) => c[1] === "household_gender")).toBe(false);
  });
});

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

  test("omitted filters add no calls besides order/range", () => {
    const { q, calls } = fakeQuery();
    applyListingFilters(q, listingFiltersSchema.parse({}));
    const filterCalls = calls.filter(([m]) => m !== "order" && m !== "range");
    expect(filterCalls).toHaveLength(0);
  });
});

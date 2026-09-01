/**
 * One rule, checked in every place that states it: the number the site prints
 * as "N roommates" is `household_size` — the people the page can actually name
 * — and never `roommates_count`, the creator's typed claim.
 *
 * The bug behind it: "Ground-floor room with a yard, Nazareth" had
 * roommates_count 1 and a two-person household, and printed "1 roommate" above
 * two faces. Every fixture here keeps the two numbers deliberately different,
 * so anything reading the wrong one fails.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { applyListingFilters } from "@/lib/listings";
import { listingFiltersSchema } from "@/lib/validation/filters";
import { featureVector } from "@/lib/affinity";
import { ListingCard } from "@/components/listings/ListingCard";
import type { Listing } from "@/lib/types";

vi.mock("@/app/actions/saved", () => ({ setSavedAction: async () => ({ ok: true }) }));

afterEach(cleanup);

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "11111111-2222-4333-8444-555555555555", owner_id: "o1", title: "Sunlit room", description: "",
    city: "Nazareth", neighborhood: "", address: "", street: "", house_number: "", lat: null, lng: null,
    coords_source: "none", rent: 2800, available_from: "2026-10-01", lease_term: "flexible",
    property_type: "apartment", rooms: 3, size_sqm: null,
    // The shape that caused the bug: a claim of 1, a household of 2.
    roommates_count: 1, household_size: 2,
    pets_allowed: false, smoking_allowed: false, wanted_gender: null, household_gender: null,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    safe_room: "none", food_restrictions: "", photo_urls: [], photo_labels: [], viewing_slots: [],
    is_active: true, created_at: "", updated_at: "", taken_at: null, removed_at: null,
    ...overrides,
  };
}

test("a Listings card counts the household, not the typed claim", () => {
  render(<ListingCard listing={listing()} />);
  expect(screen.getByText(/2 roommates/)).toBeInTheDocument();
  expect(screen.queryByText(/1 roommate\b/)).toBeNull();
});

test("one person in the home is singular", () => {
  render(<ListingCard listing={listing({ roommates_count: 4, household_size: 1 })} />);
  expect(screen.getByText(/1 roommate(?!s)/)).toBeInTheDocument();
  expect(screen.queryByText(/4 roommates/)).toBeNull();
});

test('"Max roommates" filters the number the cards show', () => {
  const calls: [string, ...unknown[]][] = [];
  const q: Record<string, (...a: unknown[]) => unknown> = {};
  for (const m of ["eq", "gte", "lte", "not", "order", "range"]) {
    q[m] = (...a: unknown[]) => {
      calls.push([m, ...a]);
      return q;
    };
  }
  applyListingFilters(q as never, listingFiltersSchema.parse({ roommates_max: "2" }));
  expect(calls).toContainEqual(["lte", "household_size", 2]);
  expect(calls.some(([, col]) => col === "roommates_count")).toBe(false);
});

test("the deck learns from the household the seeker was shown", () => {
  const v = featureVector(listing({ roommates_count: 1, household_size: 2 }));
  expect(v["roommates:2"]).toBe(1);
  expect(v["roommates:1"]).toBeUndefined();
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Listing } from "@/lib/types";

const setSavedAction = vi.fn(async () => ({ ok: true }));
vi.mock("@/app/actions/saved", () => ({ setSavedAction: (...a: unknown[]) => setSavedAction(...(a as [])) }));

import { ListingCard } from "@/components/listings/ListingCard";

afterEach(cleanup);

const listing: Listing = {
  id: "11111111-2222-4333-8444-555555555555", owner_id: "o1", title: "Sunlit room", description: "",
  city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", street: "Florentin", house_number: "12", lat: null, lng: null, coords_source: "none",
  rent: 2800, available_from: "2026-10-01", lease_term: "flexible", property_type: "apartment", rooms: 3, size_sqm: null,
  roommates_count: 2, household_size: 2, pets_allowed: true, smoking_allowed: false, wanted_gender: null, household_gender: null,
  balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
  safe_room: "none", food_restrictions: "", photo_urls: [], photo_labels: [], viewing_slots: [],
  is_active: true, created_at: "", updated_at: "",
  taken_at: null, removed_at: null,
};

test("a Listings row shows the same two scores the swipe deck does", () => {
  render(<ListingCard listing={listing} signedIn score={{ lifestyle: 82, social: 64 }} />);

  // Same phrasing as the deck's pill, because it is the same component: the
  // number, "out of 100", and the scoreLabel band.
  expect(screen.getByRole("img", { name: "Lifestyle 82 out of 100, Great fit" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Social 64 out of 100, Good" })).toBeInTheDocument();
});

test("a social score of null degrades to an em dash, not a zero", () => {
  // socialScore returns null when either side has declared no interests. Zero
  // would read as "you have nothing in common", which is a different claim.
  render(<ListingCard listing={listing} signedIn score={{ lifestyle: 55, social: null }} />);

  expect(screen.getByRole("img", { name: /Social unavailable/ })).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: /Social 0 out of 100/ })).toBeNull();
});

test("no score, no pills — Browse is public and a visitor has nothing to match against", () => {
  render(<ListingCard listing={listing} />);
  expect(screen.queryByRole("img", { name: /out of 100/ })).toBeNull();
  expect(screen.queryByRole("img", { name: /unavailable/ })).toBeNull();
});

test("a low score is shown rather than hidden", () => {
  // The deck drops anything under MIN_DECK_SCORE; Browse is where those rooms
  // stay reachable, so the number has to appear here even when it is weak.
  render(<ListingCard listing={listing} signedIn score={{ lifestyle: 23, social: 12 }} />);
  expect(screen.getByRole("img", { name: "Lifestyle 23 out of 100, Low" })).toBeInTheDocument();
});

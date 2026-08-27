import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Listing } from "@/lib/types";

const setSavedAction = vi.fn(async () => ({ ok: true }));
vi.mock("@/app/actions/saved", () => ({ setSavedAction: (...a: unknown[]) => setSavedAction(...(a as [])) }));

import { PropertyTile } from "@/components/listings/PropertyTile";

afterEach(cleanup);

const listing: Listing = {
  id: "11111111-2222-4333-8444-555555555555", owner_id: "o1", title: "Sunlit room", description: "",
  city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", street: "Florentin", house_number: "12",
  rent: 2800, available_from: "2026-10-01", lease_term: "flexible", property_type: "apartment", rooms: 3, size_sqm: null,
  roommates_count: 2, pets_allowed: true, smoking_allowed: false,
  balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
  safe_room: "none", food_restrictions: "", photo_urls: [], photo_labels: [], viewing_slots: [],
  is_active: true, created_at: "", updated_at: "",
  taken_at: null, removed_at: null,
};

test("a plain tile is just a link — no heart", () => {
  render(<PropertyTile listing={listing} caption="Viewed 1 Sep" />);
  expect(screen.getByRole("link")).toHaveAttribute("href", `/browse/${listing.id}`);
  expect(screen.queryByRole("button")).toBeNull();
});

test("Liked tile: a filled heart that unlikes on tap and likes back on the next, without following the link", async () => {
  render(<PropertyTile listing={listing} heart={{ signedIn: true, saved: true }} />);
  const heart = screen.getByRole("button", { name: "Remove from liked rooms" });
  expect(heart).toHaveAttribute("aria-pressed", "true");
  expect(heart.closest("a")).toBeNull(); // sibling of the link, never inside it

  fireEvent.click(heart);
  expect(screen.getByRole("button", { name: "Like this room" })).toHaveAttribute("aria-pressed", "false");
  await waitFor(() => expect(setSavedAction).toHaveBeenLastCalledWith(listing.id, false));

  fireEvent.click(screen.getByRole("button", { name: "Like this room" }));
  expect(screen.getByRole("button", { name: "Remove from liked rooms" })).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => expect(setSavedAction).toHaveBeenLastCalledWith(listing.id, true));
});

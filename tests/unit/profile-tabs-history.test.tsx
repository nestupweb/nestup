import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Listing, Profile } from "@/lib/types";

vi.mock("@/app/actions/saved", () => ({ setSavedAction: async () => ({ ok: true }) }));
vi.mock("@/components/profile/AboutMe", () => ({ AboutMe: () => null }));
vi.mock("@/components/profile/AboutView", () => ({ AboutView: () => null }));
vi.mock("@/components/profile/MyListing", () => ({ MyListing: () => null }));

import { ProfileTabs } from "@/components/profile/ProfileTabs";

afterEach(cleanup);

function room(id: string, title: string): Listing {
  return {
    id, owner_id: "o1", title, description: "",
    city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12", street: "Florentin", house_number: "12", lat: null, lng: null, coords_source: "none",
    rent: 2800, available_from: "2026-10-01", lease_term: "flexible", property_type: "apartment", rooms: 3, size_sqm: null,
    roommates_count: 2, pets_allowed: true, smoking_allowed: false, wanted_gender: null, household_gender: null,
    balcony: false, air_conditioning: false, parking: false, elevator: false, furnished: false,
    safe_room: "none", food_restrictions: "", photo_urls: [], photo_labels: [], viewing_slots: [],
    is_active: true, created_at: "", updated_at: "",
    taken_at: null, removed_at: null,
  } as Listing;
}

const about = { profile: { user_id: "me", full_name: "Me" } as Profile, details: null, email: "me@x.dev", readOnly: true };

test("History tiles carry the heart: filled for rooms that are also Liked, hollow otherwise", () => {
  render(
    <ProfileTabs
      mine={[]}
      liked={[{ listing: room("a", "Liked room") }]}
      history={[
        { listing: room("a", "Liked room"), caption: "Viewed today", saved: true },
        { listing: room("b", "Just viewed"), caption: "Viewed today", saved: false },
      ]}
      initial="history"
      about={about}
    />
  );
  expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("History");
  const filled = screen.getAllByRole("button", { name: "Remove from liked rooms" });
  const hollow = screen.getAllByRole("button", { name: "Like this room" });
  expect(filled).toHaveLength(1);
  expect(hollow).toHaveLength(1);
  expect(hollow[0]).toHaveAttribute("aria-pressed", "false");
  expect(hollow[0].closest("a")).toBeNull();
});

test("Liked tiles are all filled hearts, as before", () => {
  render(
    <ProfileTabs mine={[]} liked={[{ listing: room("a", "A") }, { listing: room("b", "B") }]} history={[]} initial="liked" about={about} />
  );
  expect(screen.getAllByRole("button", { name: "Remove from liked rooms" })).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Like this room" })).toBeNull();
});

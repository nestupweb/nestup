import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DeckEntry } from "@/lib/swipe";
import type { Listing, Profile } from "@/lib/types";

afterEach(cleanup);

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={String(src)} alt={String(alt ?? "")} />;
  },
}));

const recordSwipeAction = vi.fn(async () => ({ ok: true }));
vi.mock("@/app/actions/swipe", () => ({
  recordSwipeAction: (...args: unknown[]) => recordSwipeAction(...(args as [])),
}));

import { SwipeDeck } from "@/components/swipe/SwipeDeck";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "seeker", full_name: "Seeker", age: 25, occupation: "Designer", bio: "",
    avatar_url: null, smoker: false, has_pet: false, cleanliness: 3,
    sleep_schedule: "flexible", guests_freq: "sometimes",
    interests: ["Music", "Cooking"], ok_with_smoker: true, ok_with_pets: true,
    budget_min: 0, budget_max: 3000, preferred_cities: [], earliest_move_in: null,
    created_at: "", updated_at: "", ...overrides,
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "11111111-1111-4111-8111-111111111111", owner_id: "o1", title: "Sunlit loft room",
    description: "Big windows.", city: "Tel Aviv", neighborhood: "Florentin", address: "Florentin 12",
    rent: 2800, available_from: "2026-10-01", property_type: "apartment", rooms: 3, size_sqm: 80,
    roommates_count: 2, pets_allowed: true, smoking_allowed: false,
    balcony: true, air_conditioning: false, parking: false, elevator: false, furnished: true,
    photo_urls: ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"],
    is_active: true, created_at: "", updated_at: "", ...overrides,
  };
}

const owner = profile({ user_id: "o1", full_name: "Dana", age: 29, occupation: "Chef", interests: ["Cooking", "Yoga"] });
const entries: DeckEntry[] = [
  { listing: listing(), owner, residents: [profile({ user_id: "r1", full_name: "Noa", age: 24, interests: ["Hiking"] })], lifestyle: 82, social: 50 },
  {
    listing: listing({ id: "22222222-2222-4222-8222-222222222222", title: "Quiet room by the park", photo_urls: ["https://example.com/d.jpg"] }),
    owner,
    residents: [],
    lifestyle: 61,
    social: null,
  },
];

beforeEach(() => recordSwipeAction.mockClear());

test("shows both compatibility scores and the first of three photos", () => {
  render(<SwipeDeck entries={entries} seeker={profile()} />);
  expect(screen.getByRole("img", { name: /lifestyle match 82/i })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /social match 50/i })).toBeInTheDocument();
  expect(screen.getByAltText(/photo 1 of 3/)).toHaveAttribute("src", "https://example.com/a.jpg");
  expect(screen.queryByText(/1 \/ 2/)).not.toBeInTheDocument(); // no deck counter on the image
});

test("arrows move through the photos and wrap around", async () => {
  render(<SwipeDeck entries={entries} seeker={profile()} />);
  await userEvent.click(screen.getByRole("button", { name: /next photo/i }));
  expect(screen.getByAltText(/photo 2 of 3/)).toHaveAttribute("src", "https://example.com/b.jpg");
  await userEvent.click(screen.getByRole("button", { name: /previous photo/i }));
  await userEvent.click(screen.getByRole("button", { name: /previous photo/i }));
  expect(screen.getByAltText(/photo 3 of 3/)).toBeInTheDocument();
});

test("information panel has three pages with address, home details and roommates", async () => {
  render(<SwipeDeck entries={entries} seeker={profile()} />);
  expect(screen.getByRole("heading", { name: "Florentin 12" })).toBeInTheDocument();
  expect(screen.getByText("1 Oct 2026")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Essentials" })).toHaveAttribute("aria-selected", "true");

  await userEvent.click(screen.getByRole("tab", { name: "Home" }));
  expect(screen.getByText("House rules")).toBeInTheDocument();
  expect(screen.getByText("Balcony")).toBeInTheDocument();
  expect(screen.getByText("No smoking")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("tab", { name: "Roommates" }));
  expect(screen.getByText("Dana, 29")).toBeInTheDocument();
  expect(screen.getByText("Noa, 24")).toBeInTheDocument();
  expect(screen.getByText("Cooking")).toBeInTheDocument(); // shared interest chip
  expect(screen.queryByRole("button", { name: /next page/i })).not.toBeInTheDocument(); // tabs only, no chevrons
});

test("liking records the swipe and loads the next room; the last rejection empties the deck", async () => {
  render(<SwipeDeck entries={entries} seeker={profile()} />);
  await userEvent.click(screen.getByRole("button", { name: /like this room/i }));
  expect(recordSwipeAction).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "like");
  await waitFor(() => expect(screen.getByRole("article", { name: "Quiet room by the park" })).toBeInTheDocument());
  expect(screen.getByRole("img", { name: /social match unavailable/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /next photo/i })).not.toBeInTheDocument(); // single photo: no arrows

  await userEvent.click(screen.getByRole("button", { name: /not for me/i }));
  expect(recordSwipeAction).toHaveBeenLastCalledWith("22222222-2222-4222-8222-222222222222", "skip");
  await waitFor(() => expect(screen.getByText(/every strong match for now/i)).toBeInTheDocument());
});

test("an empty deck explains itself", () => {
  render(<SwipeDeck entries={[]} seeker={profile()} />);
  expect(screen.getByText(/no strong matches yet/i)).toBeInTheDocument();
});

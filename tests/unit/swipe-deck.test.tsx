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
const sendIntroAction = vi.fn(async () => ({ ok: true as const, conversationId: "33333333-3333-4333-8333-333333333333" }));
const saveIntroTemplateAction = vi.fn(async () => ({ ok: true }));
vi.mock("@/app/actions/swipe", () => ({
  recordSwipeAction: (...args: unknown[]) => recordSwipeAction(...(args as [])),
  sendIntroAction: (...args: unknown[]) => sendIntroAction(...(args as [])),
  saveIntroTemplateAction: (...args: unknown[]) => saveIntroTemplateAction(...(args as [])),
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
    safe_room: "apartment", food_restrictions: "Kosher kitchen", street: "Florentin", house_number: "12", photo_labels: [], viewing_slots: [],
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

beforeEach(() => {
  recordSwipeAction.mockClear();
  sendIntroAction.mockClear();
});

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
  expect(screen.getByRole("link", { name: "Dana's profile" })).toHaveAttribute("href", "/people/o1");
  expect(screen.getByRole("link", { name: "Noa's profile" })).toHaveAttribute("href", "/people/r1");
  expect(screen.getByText("Cooking")).toBeInTheDocument(); // shared interest chip
  expect(screen.queryByRole("button", { name: /next page/i })).not.toBeInTheDocument(); // tabs only, no chevrons
});

test("liking records the swipe, offers the hello first, then loads the next room; the last rejection empties the deck", async () => {
  render(<SwipeDeck entries={entries} seeker={profile()} />);
  await userEvent.click(screen.getByRole("button", { name: /like this room/i }));
  expect(recordSwipeAction).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "like");
  // The optional hello opens over the liked room, which stays put until the sheet closes.
  expect(screen.getByRole("dialog", { name: /say hi to dana & noa/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Florentin 12" })).toBeInTheDocument();
  expect(screen.queryByRole("article", { name: "Quiet room by the park" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /not now/i }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(sendIntroAction).not.toHaveBeenCalled();
  // Only now does the card slide away and the next room arrive.
  await waitFor(() => expect(screen.getByRole("article", { name: "Quiet room by the park" })).toBeInTheDocument());
  expect(screen.getByRole("img", { name: /social match unavailable/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /next photo/i })).not.toBeInTheDocument(); // single photo: no arrows

  await userEvent.click(screen.getByRole("button", { name: /not for me/i }));
  expect(recordSwipeAction).toHaveBeenLastCalledWith("22222222-2222-4222-8222-222222222222", "skip");
  await waitFor(() => expect(screen.getByText(/every strong match for now/i)).toBeInTheDocument());
});

test("the intro sheet sends a pre-written, editable hello, then the card slides on to the next room", async () => {
  render(<SwipeDeck entries={entries} seeker={profile()} />);
  await userEvent.click(screen.getByRole("button", { name: /like this room/i }));
  const box = screen.getByRole("textbox", { name: /message to the roommates/i }) as HTMLTextAreaElement;
  expect(box.value).toBe("Hi Dana, I liked the room — can we schedule a viewing?");
  await userEvent.clear(box);
  await userEvent.type(box, "Hello from the deck");
  await userEvent.click(screen.getByRole("button", { name: /send message/i }));
  expect(sendIntroAction).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "Hello from the deck");
  // No "open the chat" step: the sheet closes itself and the deck moves on.
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.queryByRole("link", { name: /open the chat/i })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("article", { name: "Quiet room by the park" })).toBeInTheDocument());
});

test("the seeker's saved template pre-fills the hello, and an edited text can be saved as the new default", async () => {
  render(<SwipeDeck entries={entries} seeker={profile()} introTemplate="Hey {name}, is it still free?" />);
  await userEvent.click(screen.getByRole("button", { name: /like this room/i }));
  const box = screen.getByRole("textbox", { name: /message to the roommates/i }) as HTMLTextAreaElement;
  expect(box.value).toBe("Hey Dana, is it still free?");
  expect(screen.queryByRole("button", { name: /save as my default/i })).not.toBeInTheDocument();
  await userEvent.type(box, " Thanks!");
  await userEvent.click(screen.getByRole("button", { name: /save as my default/i }));
  expect(saveIntroTemplateAction).toHaveBeenCalledWith("Hey Dana, is it still free? Thanks!");
  await waitFor(() => expect(screen.getByText(/saved as your default/i)).toBeInTheDocument());
  expect(sendIntroAction).not.toHaveBeenCalled();
});

test("an empty deck explains itself", () => {
  render(<SwipeDeck entries={[]} seeker={profile()} />);
  expect(screen.getByText(/no strong matches yet/i)).toBeInTheDocument();
});

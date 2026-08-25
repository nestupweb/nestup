import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { ConversationSummary, Viewing } from "@/lib/types";

afterEach(cleanup);

vi.mock("@/app/actions/viewing", () => ({
  respondViewingAction: vi.fn(async () => ({ ok: true })),
  syncViewingToGoogleAction: vi.fn(async () => ({ ok: true })),
}));

import { ViewingCard } from "@/components/chat/ViewingCard";

const conversation: ConversationSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  listing_id: "22222222-2222-4222-8222-222222222222",
  listing_title: "Room in a 3-room apartment in Florentin",
  listing_city: "Tel Aviv",
  listing_address: "Florentin 12",
  listing_rent: 3500,
  listing_photo: null,
  seeker_id: "seeker",
  owner_id: "owner",
  other_user_id: "owner",
  other_name: "Dana Levi",
  other_avatar: null,
  last_message: null,
  last_message_at: null,
  last_sender_id: null,
  unread_count: 0,
  created_at: "2026-08-25T10:00:00Z",
  household: [],
  listing_viewing_slots: [],
  next_viewing_starts_at: null,
  next_viewing_ends_at: null,
};

function viewing(overrides: Partial<Viewing> = {}): Viewing {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    conversation_id: conversation.id,
    proposed_by: "seeker",
    starts_at: "2026-09-06T15:00:00Z",
    ends_at: "2026-09-06T15:45:00Z",
    status: "proposed",
    note: "",
    google_event_id: null,
    google_event_link: null,
    created_at: "2026-08-25T10:00:00Z",
    ...overrides,
  };
}

test("a pending request shows 'Pending approval' and no calendar link", () => {
  render(<ViewingCard viewing={viewing()} meId="seeker" conversation={conversation} />);
  expect(screen.getByText("Pending approval")).toBeInTheDocument();
  expect(screen.getByText("You requested a viewing")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /calendar/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument(); // proposer can't approve
  expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  expect(screen.getByText(/once Dana Levi approves/i)).toBeInTheDocument();
});

test("the other party sees Approve / Decline", () => {
  render(<ViewingCard viewing={viewing()} meId="owner" conversation={conversation} />);
  expect(screen.getByText("Dana Levi requested a viewing")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /calendar/i })).not.toBeInTheDocument();
});

test("an approved viewing unlocks the calendar link (and the invite button with Google connected)", () => {
  render(
    <ViewingCard
      viewing={viewing({ status: "confirmed" })}
      meId="seeker"
      conversation={conversation}
      google={{ configured: true, connected: true, email: "me@example.com" }}
    />
  );
  expect(screen.getByText("Approved")).toBeInTheDocument();
  const link = screen.getByRole("link", { name: /add to google calendar/i });
  expect(link).toHaveAttribute("href", expect.stringContaining("calendar.google.com"));
  expect(screen.getByRole("button", { name: /send invite to Dana Levi/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
});

test("a declined viewing is closed — no actions, no calendar", () => {
  render(<ViewingCard viewing={viewing({ status: "declined" })} meId="owner" conversation={conversation} />);
  expect(screen.getByText("Declined")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

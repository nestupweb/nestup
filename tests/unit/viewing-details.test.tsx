import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ViewingScheduledChip, viewingParticipants } from "@/components/chat/ViewingDetails";
import type { ConversationSummary, Viewing } from "@/lib/types";

afterEach(cleanup);

const conversation: ConversationSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  listing_id: "22222222-2222-4222-8222-222222222222",
  listing_title: "Sunlit room in a Florentin loft",
  listing_city: "Tel Aviv",
  listing_address: "Florentin 12",
  listing_rent: 5400,
  listing_photo: null,
  seeker_id: "seeker",
  owner_id: "owner",
  other_user_id: "owner",
  other_name: "Noa Peretz",
  other_avatar: null,
  last_message: null,
  last_message_at: null,
  last_sender_id: null,
  unread_count: 0,
  created_at: "2026-08-25T10:00:00Z",
  household: [
    { user_id: "owner", full_name: "Noa Peretz", avatar_url: null },
    { user_id: "r1", full_name: "Alona Berg", avatar_url: null },
  ],
  listing_viewing_slots: [],
  next_viewing_starts_at: "2026-09-06T15:00:00Z",
  next_viewing_ends_at: "2026-09-06T15:45:00Z",
};

const viewing: Viewing = {
  id: "33333333-3333-4333-8333-333333333333",
  conversation_id: conversation.id,
  proposed_by: "seeker",
  starts_at: "2026-09-06T15:00:00Z",
  ends_at: "2026-09-06T15:45:00Z",
  status: "confirmed",
  note: "Ring twice, the bell is shy.",
  google_event_id: null,
  google_event_link: null,
  created_at: "2026-08-25T10:00:00Z",
};

test("the chip opens every appointment detail; Escape closes it", () => {
  render(<ViewingScheduledChip viewing={viewing} conversation={conversation} meId="seeker" />);
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /viewing scheduled/i }));
  const dialog = screen.getByRole("dialog");
  const q = within(dialog);
  const longDate = new Date(viewing.starts_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  expect(q.getByRole("heading", { name: longDate })).toBeInTheDocument();
  expect(q.getByText("Date").nextElementSibling).toHaveTextContent(longDate);
  expect(q.getByText("Time").nextElementSibling).toHaveTextContent(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
  expect(q.getByRole("link", { name: "Sunlit room in a Florentin loft" })).toHaveAttribute("href", `/browse/${conversation.listing_id}`);
  expect(q.getByText("Florentin 12, Tel Aviv")).toBeInTheDocument();
  expect(q.getByText("₪5,400 / month")).toBeInTheDocument();
  const people = q.getByText("Participants").nextElementSibling!;
  expect(people).toHaveTextContent("You");
  expect(people).toHaveTextContent("Noa Peretz");
  expect(people).toHaveTextContent("Alona Berg");
  expect(q.getByText("Ring twice, the bell is shy.")).toBeInTheDocument();
  expect(q.getByRole("link", { name: /add to google calendar/i })).toHaveAttribute("target", "_blank");

  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("participants are listed from each side's point of view", () => {
  expect(viewingParticipants(conversation, "seeker").map((p) => p.name)).toEqual(["You", "Noa Peretz", "Alona Berg"]);
  const hostView = { ...conversation, other_name: "Dana Levi", other_user_id: "seeker" };
  expect(viewingParticipants(hostView, "owner").map((p) => p.name)).toEqual(["You", "Dana Levi"]);
});

test("a viewing with no note says so", () => {
  render(<ViewingScheduledChip viewing={{ ...viewing, note: "" }} conversation={conversation} meId="owner" />);
  fireEvent.click(screen.getByRole("button", { name: /viewing scheduled/i }));
  expect(screen.getByText("No notes")).toBeInTheDocument();
});

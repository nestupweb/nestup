import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { TakenState } from "@/app/actions/listing-status";

const count = vi.fn(async () => ({ count: 3 }));
const markTaken = vi.fn<(prev: TakenState, data: FormData) => Promise<TakenState>>();
const reopen = vi.fn(async () => ({}) as TakenState);

vi.mock("@/app/actions/listing-status", () => ({
  listingChatCountAction: (id: string) => count(id),
  markListingTakenAction: (prev: TakenState, data: FormData) => markTaken(prev, data),
  reopenListingAction: (id: string) => reopen(id),
}));

import { MarkTaken } from "@/components/listings/MarkTaken";

const LISTING = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  count.mockClear();
  markTaken.mockReset();
  reopen.mockClear();
});
afterEach(cleanup);

test("opening the panel says how many people will hear about it", async () => {
  render(<MarkTaken listingId={LISTING} title="Sunlit room in Florentin" takenAt={null} />);
  await userEvent.click(screen.getByRole("button", { name: /the room is taken/i }));

  await waitFor(() => expect(screen.getByText(/3 people you are chatting with/i)).toBeInTheDocument(), {
    timeout: 8000,
  });
  // The message is offered filled in, and names the room.
  const offered = screen.getByLabelText(/the message they will read/i) as HTMLTextAreaElement;
  expect(offered.value).toContain("Sunlit room in Florentin");
});

test("the owner can rewrite the message, and it is what gets sent", async () => {
  markTaken.mockResolvedValue({ told: 3 });
  render(<MarkTaken listingId={LISTING} title="Sunlit room in Florentin" takenAt={null} />);
  await userEvent.click(screen.getByRole("button", { name: /the room is taken/i }));

  const box = screen.getByLabelText(/the message they will read/i);
  await userEvent.clear(box);
  await userEvent.type(box, "Room's gone — good luck!");
  await userEvent.click(screen.getByRole("button", { name: /close the room/i }));

  await waitFor(() => expect(markTaken).toHaveBeenCalled(), { timeout: 8000 });
  const sent = markTaken.mock.calls[0][1];
  expect(sent.get("message")).toBe("Room's gone — good luck!");
  expect(sent.get("listing_id")).toBe(LISTING);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/3 people were told/i), { timeout: 8000 });
});

test("a rejected close keeps the message the owner wrote", async () => {
  markTaken.mockResolvedValue({ error: "This room is already marked as taken." });
  render(<MarkTaken listingId={LISTING} title="Sunlit room" takenAt={null} />);
  await userEvent.click(screen.getByRole("button", { name: /the room is taken/i }));

  const box = screen.getByLabelText(/the message they will read/i);
  await userEvent.clear(box);
  await userEvent.type(box, "Taken, sorry!");
  await userEvent.click(screen.getByRole("button", { name: /close the room/i }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/already marked as taken/i), {
    timeout: 8000,
  });
  expect(box).toHaveValue("Taken, sorry!");
});

test("a closed room shows when it was closed and offers to put it back up", async () => {
  render(<MarkTaken listingId={LISTING} title="Sunlit room" takenAt="2026-08-27T10:00:00.000Z" />);

  expect(screen.getByText(/Marked taken on 27 August 2026/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /the room is taken/i })).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: /put the room back up/i }));
  await waitFor(() => expect(reopen).toHaveBeenCalledWith(LISTING), { timeout: 8000 });
});

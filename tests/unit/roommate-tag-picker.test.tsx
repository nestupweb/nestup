import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { TaggedMember } from "@/lib/co-posters";

const search = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/co-posters", () => ({ searchMembersAction: search }));

import { RoommateTagPicker } from "@/components/listings/RoommateTagPicker";

afterEach(cleanup);

const maya: TaggedMember = { user_id: "u1", full_name: "Maya Cohen", avatar_url: null, occupation: "Designer" };
const noa: TaggedMember = { user_id: "u2", full_name: "Noa Levi", avatar_url: null, occupation: "Nurse" };

beforeEach(() => {
  search.mockReset();
  search.mockResolvedValue({ members: [maya, noa] });
});

/** The picker debounces by 300ms; these tests drive real timers through it. */
async function searchFor(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole("combobox"), text);
  await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), { timeout: 3000 });
}

test("picking someone posts their id and says they will be asked", async () => {
  const user = userEvent.setup();
  const { container } = render(<RoommateTagPicker initial={[]} roommatesCount={3} />);

  await searchFor(user, "co");
  await user.click(within(screen.getByRole("listbox")).getByRole("button", { name: /maya cohen/i }));

  expect(container.querySelectorAll('input[name="tagged_roommates"]')).toHaveLength(1);
  expect(container.querySelector('input[name="tagged_roommates"]')).toHaveValue("u1");
  expect(screen.getByText("Will be asked when you publish")).toBeInTheDocument();
});

test("the cap is roommates_count - 1: at the cap the search is closed off", async () => {
  const user = userEvent.setup();
  // 2 current roommates → 1 may be tagged, because the other room is the ad.
  render(<RoommateTagPicker initial={[]} roommatesCount={2} />);
  expect(screen.getByText("0 of 1 tagged")).toBeInTheDocument();

  await searchFor(user, "co");
  await user.click(within(screen.getByRole("listbox")).getByRole("button", { name: /maya cohen/i }));

  expect(screen.getByText("1 of 1 tagged")).toBeInTheDocument();
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Every spot is tagged");
});

test("with one roommate there is no room to tag anyone", () => {
  render(<RoommateTagPicker initial={[]} roommatesCount={1} />);
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(screen.getByText("No room to tag anyone yet")).toBeInTheDocument();
});

test("lowering the roommate count past the tags already picked explains the conflict", () => {
  // The parent owns the number, so a re-render with a smaller one is exactly
  // what happens when the member edits "Current roommates" downwards.
  const tagged = [{ ...maya, status: "pending" as const }, { ...noa, status: "accepted" as const }];
  const { rerender } = render(<RoommateTagPicker initial={tagged} roommatesCount={3} />);
  expect(screen.queryByRole("alert")).toBeNull();

  rerender(<RoommateTagPicker initial={tagged} roommatesCount={2} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/can tag 1 roommate with 2 current roommates/i);
});

test("existing tags show each roommate's answer, and can be removed", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <RoommateTagPicker
      initial={[{ ...maya, status: "accepted" }, { ...noa, status: "declined" }]}
      roommatesCount={4}
    />
  );
  expect(screen.getByText("Joined")).toBeInTheDocument();
  expect(screen.getByText("Declined")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /remove maya cohen/i }));

  expect(container.querySelectorAll('input[name="tagged_roommates"]')).toHaveLength(1);
  expect(container.querySelector('input[name="tagged_roommates"]')).toHaveValue("u2");
});

test("someone already tagged is not offered again", async () => {
  const user = userEvent.setup();
  render(<RoommateTagPicker initial={[{ ...maya, status: "pending" }]} roommatesCount={4} />);

  await searchFor(user, "co");

  const options = within(screen.getByRole("listbox")).getAllByRole("button");
  expect(options).toHaveLength(1);
  expect(options[0]).toHaveTextContent("Noa Levi");
});

test("a one-letter query never reaches the server", async () => {
  const user = userEvent.setup();
  render(<RoommateTagPicker initial={[]} roommatesCount={3} />);

  await user.type(screen.getByRole("combobox"), "m");
  await new Promise((r) => setTimeout(r, 500));

  expect(search).not.toHaveBeenCalled();
});

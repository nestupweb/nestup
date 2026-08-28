import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PendingInvite } from "@/lib/co-posters";
import type { Listing } from "@/lib/types";

const respond = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/co-posters", () => ({ respondToInviteAction: respond }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, ...props }: { fill?: boolean; sizes?: string; src: string; alt: string; className?: string }) => <img {...props} />,
}));

import { CoPosterInvites } from "@/components/profile/CoPosterInvites";

afterEach(cleanup);
beforeEach(() => {
  respond.mockReset();
  respond.mockResolvedValue({});
});

const invite: PendingInvite = {
  id: "33333333-3333-4333-8333-333333333333",
  listing: {
    id: "l1",
    title: "Sunny room in Florentin",
    rent: 4200,
    city: "Tel Aviv",
    photo_urls: ["https://x/a.jpg"],
  } as unknown as Listing,
  inviter: { user_id: "u1", full_name: "Maya Cohen", avatar_url: null },
};

test("no invitations renders nothing at all", () => {
  const { container } = render(<CoPosterInvites invites={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test("the card asks the question by name and offers both answers", () => {
  render(<CoPosterInvites invites={[invite]} />);
  expect(
    screen.getByText("Maya Cohen added you to a shared listing. Confirm to join as a co-poster?")
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /yes, join as co-poster/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /no, thanks/i })).toBeInTheDocument();
  // The room it is about is reachable without answering first.
  expect(screen.getByRole("link", { name: /sunny room in florentin/i })).toHaveAttribute("href", "/browse/l1");
});

test("Yes sends the invite id and an affirmative answer", async () => {
  const user = userEvent.setup();
  render(<CoPosterInvites invites={[invite]} />);

  await user.click(screen.getByRole("button", { name: /yes, join as co-poster/i }));

  expect(respond).toHaveBeenCalledTimes(1);
  const sent = respond.mock.calls[0][1] as FormData;
  expect(sent.get("invite_id")).toBe(invite.id);
  expect(sent.get("answer")).toBe("yes");
});

test("No sends the same id with the opposite answer", async () => {
  const user = userEvent.setup();
  render(<CoPosterInvites invites={[invite]} />);

  await user.click(screen.getByRole("button", { name: /no, thanks/i }));

  const sent = respond.mock.calls[0][1] as FormData;
  expect(sent.get("invite_id")).toBe(invite.id);
  expect(sent.get("answer")).toBe("no");
});

test("each invitation carries its own id, so answering one never answers another", async () => {
  const user = userEvent.setup();
  const second: PendingInvite = {
    ...invite,
    id: "44444444-4444-4444-8444-444444444444",
    inviter: { user_id: "u2", full_name: "Noa Levi", avatar_url: null },
  };
  render(<CoPosterInvites invites={[invite, second]} />);

  const noaCard = screen.getByRole("form", { name: /invitation from noa levi/i });
  await user.click(within(noaCard).getByRole("button", { name: /yes, join as co-poster/i }));

  expect((respond.mock.calls[0][1] as FormData).get("invite_id")).toBe(second.id);
});

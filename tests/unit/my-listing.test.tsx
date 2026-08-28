import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PendingInvite } from "@/lib/co-posters";
import type { Listing } from "@/lib/types";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, ...props }: { fill?: boolean; sizes?: string; src: string; alt: string; className?: string }) => <img {...props} />,
}));
vi.mock("@/app/actions/co-posters", () => ({ respondToInviteAction: vi.fn() }));

import { EDIT_PHOTOS_HREF, MyListing } from "@/components/profile/MyListing";

afterEach(cleanup);

const listing = {
  id: "l1",
  title: "Sunny room in Florentin",
  rent: 4200,
  city: "Tel Aviv",
  is_active: true,
  photo_urls: ["https://x/a.jpg", "https://x/b.jpg", "https://x/c.jpg"],
  photo_labels: ["living_room", "bedroom", "bathroom"],
} as unknown as Listing;

describe("MyListing", () => {
  test("no listing → one dashed 'Add listing' square that starts the form", () => {
    render(<MyListing listings={[]} />);
    expect(screen.getByRole("link", { name: /add listing/i })).toHaveAttribute("href", "/listing");
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("a listing → every photo side by side, each with a pencil to the form's Photos section", () => {
    render(<MyListing listings={[listing]} />);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByRole("img", { name: /bedroom/i })).toHaveAttribute("src", "https://x/b.jpg");
    const pencils = screen.getAllByRole("link", { name: /^edit photo \d$/i });
    expect(pencils).toHaveLength(3);
    for (const p of pencils) expect(p).toHaveAttribute("href", EDIT_PHOTOS_HREF);
    expect(screen.getByText("Bedroom")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: listing.title })).toHaveAttribute("href", "/browse/l1");
    expect(screen.queryByText("Paused")).toBeNull();
    expect(screen.queryByRole("link", { name: /add listing/i })).toBeNull();
  });

  test("a paused listing without photos is flagged and offers 'Add photos'", () => {
    render(<MyListing listings={[{ ...listing, is_active: false, photo_urls: [], photo_labels: [] }]} />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add photos/i })).toHaveAttribute("href", EDIT_PHOTOS_HREF);
  });
});

/**
 * Shared listings (migration 0032). A co-posted room is shown, not managed:
 * editing, closing and deleting stay with the member who created it, which is
 * also the only thing the database allows.
 */
describe("MyListing — shared listings", () => {
  const invite: PendingInvite = {
    id: "i1",
    listing: { ...listing, id: "l9", title: "Room in Ramat Gan" } as Listing,
    inviter: { user_id: "u1", full_name: "Maya Cohen", avatar_url: null },
  };

  test("a pending invitation sits above the member's own room, asking by name", () => {
    render(<MyListing listings={[listing]} invites={[invite]} />);
    expect(
      screen.getByText("Maya Cohen added you to a shared listing. Confirm to join as a co-poster?")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, join as co-poster/i })).toBeInTheDocument();
  });

  test("a member with no room of their own still gets 'Add listing' alongside an invitation", () => {
    render(<MyListing listings={[]} invites={[invite]} />);
    expect(screen.getByRole("link", { name: /add listing/i })).toHaveAttribute("href", "/listing");
    expect(screen.getByRole("button", { name: /no, thanks/i })).toBeInTheDocument();
  });

  test("a confirmed co-posted room appears under 'Shared with you', badged", () => {
    const co = { ...listing, id: "l2", title: "Room in Haifa" } as Listing;
    render(<MyListing listings={[listing]} shared={[co]} />);

    expect(screen.getByText("Shared with you")).toBeInTheDocument();
    const section = screen.getByRole("region", { name: "Room in Haifa" });
    expect(within(section).getByText("Co-poster")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Room in Haifa" })).toHaveAttribute("href", "/browse/l2");
  });

  test("a co-poster gets no owner's buttons on a room that is not theirs", () => {
    const co = { ...listing, id: "l2", title: "Room in Haifa" } as Listing;
    render(<MyListing listings={[]} shared={[co]} />);

    const section = screen.getByRole("region", { name: "Room in Haifa" });
    expect(within(section).queryByRole("link", { name: /^edit photo \d$/i })).toBeNull();
    expect(within(section).queryByRole("link", { name: /edit listing/i })).toBeNull();
    expect(within(section).queryByRole("button", { name: /delete listing/i })).toBeNull();
    expect(within(section).queryByRole("button", { name: /taken/i })).toBeNull();
  });

  test("with neither invitations nor shared rooms nothing extra is rendered", () => {
    render(<MyListing listings={[listing]} />);
    expect(screen.queryByText("Shared with you")).toBeNull();
    expect(screen.queryByRole("button", { name: /join as co-poster/i })).toBeNull();
  });
});

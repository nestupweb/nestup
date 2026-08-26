import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Listing } from "@/lib/types";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @next/next/no-img-element
  default: ({ fill, sizes, ...props }: { fill?: boolean; sizes?: string; src: string; alt: string; className?: string }) => <img {...props} />,
}));

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

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(cleanup);

vi.mock("@/app/actions/listing", () => ({ deleteListingAction: vi.fn() }));

import { ListingActions } from "@/components/profile/ListingActions";

describe("ListingActions", () => {
  test("offers Edit Listing and Delete Listing side by side", () => {
    render(<ListingActions listingId="l1" editHref="/listing#photos" />);
    expect(screen.getByRole("link", { name: "Edit Listing" })).toHaveAttribute("href", "/listing#photos");
    expect(screen.getByRole("button", { name: /Delete Listing/ })).toBeInTheDocument();
  });

  test("deleting asks first and explains what goes with it", async () => {
    render(<ListingActions listingId="l1" editHref="/listing#photos" />);
    // Nothing is submittable until the member has been warned.
    expect(screen.queryByRole("button", { name: /Yes, Delete It/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /Delete Listing/ }));
    expect(screen.getByRole("button", { name: /Yes, Delete It/ })).toBeInTheDocument();
    expect(screen.getByText(/off NestUp for good/i)).toBeInTheDocument();
    // The chats are explicitly kept now — the old copy promised the opposite.
    expect(screen.getByText(/conversations stay/i)).toBeInTheDocument();
    expect(screen.getByText(/The room is taken/i)).toBeInTheDocument();
  });

  test("cancelling backs out and leaves the listing alone", async () => {
    render(<ListingActions listingId="l1" editHref="/listing#photos" />);
    await userEvent.click(screen.getByRole("button", { name: /Delete Listing/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: /Yes, Delete It/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Delete Listing/ })).toBeInTheDocument();
  });

  test("carries the listing id with the submission", async () => {
    const { container } = render(<ListingActions listingId="listing-42" editHref="/listing#photos" />);
    await userEvent.click(screen.getByRole("button", { name: /Delete Listing/ }));
    const hidden = container.querySelector('input[name="listing_id"]') as HTMLInputElement;
    expect(hidden.value).toBe("listing-42");
  });

  test("a further owner action sits in the same row, and steps aside while confirming", async () => {
    render(
      <ListingActions listingId="l1" editHref="/listing#photos">
        <button type="button">The room is taken</button>
      </ListingActions>
    );
    const slotted = screen.getByRole("button", { name: "The room is taken" });
    // same flex row as Edit / Delete, not stranded on a line of its own
    expect(slotted.parentElement).toBe(screen.getByRole("link", { name: "Edit Listing" }).parentElement);

    await userEvent.click(screen.getByRole("button", { name: /Delete Listing/ }));
    expect(screen.queryByRole("button", { name: "The room is taken" })).toBeNull();
  });
});

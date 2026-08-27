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
    expect(screen.getByText(/chats about it/i)).toBeInTheDocument();
    expect(screen.getByText(/pause it in Settings instead/i)).toBeInTheDocument();
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
});

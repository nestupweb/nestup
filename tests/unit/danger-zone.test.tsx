import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ListingHeir } from "@/lib/handover";

afterEach(cleanup);

// The action is a server action; the component only needs it to exist.
vi.mock("@/app/actions/settings", () => ({ deleteAccountAction: vi.fn(async () => ({})) }));

import { DangerZone } from "@/components/settings/DangerZone";

function heir(name: string, over: Partial<ListingHeir> = {}): ListingHeir {
  return {
    resident_id: name.toLowerCase(),
    full_name: name,
    avatar_url: null,
    eligible: true,
    listing_id: "l1",
    listing_title: "Sunny room in Florentin",
    ...over,
  };
}

const arm = async () => userEvent.type(screen.getByLabelText(/type your e-mail address/i), "me@nestup.dev");
const hidden = () => document.querySelector<HTMLInputElement>('input[name="heir"]')!;

describe("DangerZone", () => {
  test("the delete button stays disabled until the exact e-mail is typed", async () => {
    render(<DangerZone email="me@nestup.dev" heirs={[]} />);
    const button = screen.getByRole("button", { name: /delete my account/i });
    const field = screen.getByLabelText(/type your e-mail address/i);
    expect(button).toBeDisabled();

    await userEvent.type(field, "me@nestup.de");
    expect(button).toBeDisabled();

    await userEvent.type(field, "v");
    expect(button).toBeEnabled();
  });

  test("the match ignores case and surrounding spaces", async () => {
    render(<DangerZone email="me@nestup.dev" heirs={[]} />);
    await userEvent.type(screen.getByLabelText(/type your e-mail address/i), "  ME@NestUp.dev ");
    expect(screen.getByRole("button", { name: /delete my account/i })).toBeEnabled();
  });

  test("alone on the listing: it goes with the account, as it always did", async () => {
    render(<DangerZone email="me@nestup.dev" heirs={[]} />);
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(screen.getByText(/your listing, the rooms you saved/)).toBeInTheDocument();
    expect(screen.queryByText(/stays where it is/)).toBeNull();
    expect(hidden().value).toBe(""); // nobody to hand it to

    await arm();
    // No picker to open: one press is the whole flow.
    await userEvent.click(screen.getByRole("button", { name: /delete my account/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("one roommate: the room passes to them without being asked", async () => {
    render(<DangerZone email="me@nestup.dev" heirs={[heir("Noa Bar")]} />);

    expect(screen.getByText(/Noa Bar lives there too/)).toBeInTheDocument();
    // The old promise to delete the listing is gone — it would be a lie.
    expect(screen.queryByText(/your listing, the rooms you saved/)).toBeNull();
    expect(hidden().value).toBe("noa bar");

    await arm();
    await userEvent.click(screen.getByRole("button", { name: /delete my account/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("several roommates: deleting asks who takes the room first", async () => {
    render(<DangerZone email="me@nestup.dev" heirs={[heir("Noa Bar"), heir("Yonatan Katz")]} />);

    expect(screen.getByText(/2 of your roommates live/)).toBeInTheDocument();
    expect(hidden().value).toBe(""); // deliberately unanswered

    await arm();
    await userEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Who takes over Sunny room in Florentin?");

    // Nothing can be submitted until one of them is picked.
    const confirm = screen.getByRole("button", { name: /hand over & delete/i });
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole("radio", { name: /yonatan katz/i }));
    expect(hidden().value).toBe("yonatan katz");
    expect(confirm).toBeEnabled();
  });

  test("a roommate with a room of their own is explained, not silently dropped", async () => {
    render(
      <DangerZone
        email="me@nestup.dev"
        heirs={[heir("Noa Bar"), heir("Yonatan Katz", { eligible: false })]}
      />
    );

    // One eligible heir left, so it is the no-question case again...
    expect(screen.getByText(/Noa Bar lives there too/)).toBeInTheDocument();
    expect(hidden().value).toBe("noa bar");
    // ...and the member is told why the other one isn't part of it.
    expect(screen.getByText(/Yonatan Katz already has a room of their own/)).toBeInTheDocument();

    await arm();
    await userEvent.click(screen.getByRole("button", { name: /delete my account/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("cancelling the picker leaves the account alone", async () => {
    render(<DangerZone email="me@nestup.dev" heirs={[heir("Noa Bar"), heir("Yonatan Katz")]} />);
    await arm();
    await userEvent.click(screen.getByRole("button", { name: /delete my account/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

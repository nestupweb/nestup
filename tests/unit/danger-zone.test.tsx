import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(cleanup);

// The action is a server action; the component only needs it to exist.
vi.mock("@/app/actions/settings", () => ({ deleteAccountAction: vi.fn() }));

import { DangerZone } from "@/components/settings/DangerZone";

describe("DangerZone", () => {
  test("the delete button stays disabled until the exact e-mail is typed", async () => {
    render(<DangerZone email="me@nestup.dev" />);
    const button = screen.getByRole("button", { name: /delete my account/i });
    const field = screen.getByLabelText(/type your e-mail address/i);
    expect(button).toBeDisabled();

    await userEvent.type(field, "me@nestup.de");
    expect(button).toBeDisabled();

    await userEvent.type(field, "v");
    expect(button).toBeEnabled();
  });

  test("the match ignores case and surrounding spaces", async () => {
    render(<DangerZone email="me@nestup.dev" />);
    await userEvent.type(screen.getByLabelText(/type your e-mail address/i), "  ME@NestUp.dev ");
    expect(screen.getByRole("button", { name: /delete my account/i })).toBeEnabled();
  });

  test("says plainly what is destroyed", () => {
    render(<DangerZone email="me@nestup.dev" />);
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });
});

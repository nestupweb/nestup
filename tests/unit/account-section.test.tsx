import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

/**
 * The e-mail row's step machine.
 *
 * The bug these cover: the view used to be driven by `emailState.sent`, which
 * is `useActionState` and so keeps its last result for as long as the
 * component is mounted. A finished change therefore left the code boxes on
 * screen forever, and "Change" reopened the row straight back onto the stale
 * code screen instead of the address form.
 */
const changeEmailAction = vi.fn();
const verifyEmailChangeCodeAction = vi.fn();
const resendEmailChangeCodeAction = vi.fn();
vi.mock("@/app/actions/auth", () => ({
  changeEmailAction: (...a: unknown[]) => changeEmailAction(...a),
  verifyEmailChangeCodeAction: (...a: unknown[]) => verifyEmailChangeCodeAction(...a),
  resendEmailChangeCodeAction: (...a: unknown[]) => resendEmailChangeCodeAction(...a),
  changePasswordAction: vi.fn(async () => ({})),
}));

import { AccountSection } from "@/components/settings/AccountSection";

afterEach(cleanup);
beforeEach(() => {
  changeEmailAction.mockReset().mockResolvedValue({ sent: true, email: "new@nestup.dev" });
  verifyEmailChangeCodeAction.mockReset().mockResolvedValue({ done: true });
  resendEmailChangeCodeAction.mockReset().mockResolvedValue({ sent: true, email: "new@nestup.dev" });
});

const emailRow = () => screen.getAllByRole("button", { name: /change|cancel/i })[0];
const codeBoxes = () => screen.queryByRole("group", { name: /confirmation code/i });

/** Open the row, type the new address, submit — leaving the code screen up. */
async function reachCodeStep() {
  await userEvent.click(emailRow());
  await userEvent.type(screen.getByLabelText(/new e-mail address/i), "new@nestup.dev");
  await userEvent.click(screen.getByRole("button", { name: /send code/i }));
  await waitFor(() => expect(codeBoxes()).toBeInTheDocument());
}

test("a correct code closes the code boxes and confirms the change", async () => {
  render(<AccountSection email="me@nestup.dev" />);
  await reachCodeStep();

  await userEvent.type(screen.getAllByLabelText(/^digit /i)[0], "123456");
  await userEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/email address has been updated/i));
  // The whole point: the code screen is gone, not merely covered up.
  expect(codeBoxes()).toBeNull();
  expect(screen.queryByLabelText(/new e-mail address/i)).toBeNull();
});

test("changing it again starts over at the address form, never the old code boxes", async () => {
  render(<AccountSection email="me@nestup.dev" />);
  await reachCodeStep();
  await userEvent.type(screen.getAllByLabelText(/^digit /i)[0], "123456");
  await userEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
  await waitFor(() => expect(codeBoxes()).toBeNull());

  await userEvent.click(emailRow());

  expect(screen.getByLabelText(/new e-mail address/i)).toBeInTheDocument();
  expect(codeBoxes()).toBeNull();
});

/**
 * Caught on the live site rather than here: cancelling out of a half-finished
 * verification used to leave the step at "code", so the next "Change" reopened
 * straight onto the old boxes. Cancel abandons the flow.
 */
test("cancelling mid-verification and reopening starts over at the address form", async () => {
  render(<AccountSection email="me@nestup.dev" />);
  await reachCodeStep();

  await userEvent.click(emailRow()); // Cancel
  await userEvent.click(emailRow()); // Change

  expect(screen.getByLabelText(/new e-mail address/i)).toBeInTheDocument();
  expect(codeBoxes()).toBeNull();
});

test("a wrong code keeps the boxes open and says so", async () => {
  verifyEmailChangeCodeAction.mockResolvedValue({
    error: "That code is wrong or has expired. Send a new one.",
    email: "new@nestup.dev",
  });
  render(<AccountSection email="me@nestup.dev" />);
  await reachCodeStep();

  await userEvent.type(screen.getAllByLabelText(/^digit /i)[0], "999999");
  await userEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/wrong or has expired/i));
  expect(codeBoxes()).toBeInTheDocument();
});

/**
 * A fresh mount is what a refresh or a re-navigation to /settings produces.
 * Nothing about a previous change may survive it — there is no storage behind
 * this state, and this is the test that keeps it that way.
 */
test("a reload lands back on the address form with no leftover verification state", async () => {
  const { unmount } = render(<AccountSection email="me@nestup.dev" />);
  await reachCodeStep();
  unmount();

  render(<AccountSection email="me@nestup.dev" />);
  expect(codeBoxes()).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();

  await userEvent.click(emailRow());
  expect(screen.getByLabelText(/new e-mail address/i)).toBeInTheDocument();
});

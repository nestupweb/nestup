import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { AuthForm } from "@/components/auth/AuthForm";

afterEach(cleanup);
const action = vi.fn(async () => ({}));

test("login offers a forgot-password link and an eye on the password field", () => {
  render(<AuthForm mode="login" action={action} />);
  expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
});

test("signup has the eye but no forgot-password link", () => {
  render(<AuthForm mode="signup" action={action} />);
  expect(screen.queryByRole("link", { name: "Forgot your password?" })).toBeNull();
  expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
});

test("shows the notice the login page passes for a failed emailed link", () => {
  render(<AuthForm mode="login" action={action} notice="That password-reset link was invalid or expired." />);
  expect(screen.getByRole("status")).toHaveTextContent(/reset link was invalid/);
});

test("a rejected signup keeps the email that was already typed", async () => {
  const reject = vi.fn(async () => ({ error: "Password must be at least 8 characters." }));
  render(<AuthForm mode="signup" action={reject} />);
  await userEvent.type(screen.getByLabelText("Email"), "dana@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "short");
  await userEvent.click(screen.getByRole("button", { name: "Sign up" }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/at least 8 characters/), { timeout: 8000 });
  // The whole point: the error does not cost the member what they already filled in.
  expect(screen.getByLabelText("Email")).toHaveValue("dana@example.com");
  expect(screen.getByLabelText("Password")).toHaveValue("short");
});

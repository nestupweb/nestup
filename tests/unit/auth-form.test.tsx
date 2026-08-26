import { cleanup, render, screen } from "@testing-library/react";
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

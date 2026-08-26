import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { PasswordInput } from "@/components/auth/PasswordInput";

test("the eye button reveals and re-hides the password without submitting", async () => {
  render(
    <label>
      Password
      <PasswordInput name="password" autoComplete="current-password" minLength={8} />
    </label>
  );
  const input = screen.getByLabelText("Password");
  expect(input).toHaveAttribute("type", "password");
  expect(input).toHaveAttribute("name", "password");
  expect(input).toHaveAttribute("minlength", "8");

  const eye = screen.getByRole("button", { name: "Show password" });
  expect(eye).toHaveAttribute("type", "button");
  expect(eye).toHaveAttribute("aria-pressed", "false");

  await userEvent.type(input, "hunter22");
  await userEvent.click(eye);
  expect(input).toHaveAttribute("type", "text");
  expect(input).toHaveValue("hunter22");
  expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

  await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(input).toHaveAttribute("type", "password");
});

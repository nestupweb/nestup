/**
 * The no-city modal on Swipe: the prompt a member gets when they save a profile
 * without naming a city. It has to say plainly that no matches will reach them,
 * offer the way to fix it, and still be dismissible every way a dialog can be —
 * the profile did save, and "Not now" is a real answer.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { NoCityPrompt } from "@/components/profile/NoCityPrompt";
import { FINISH_APARTMENT_PREFS } from "@/lib/apartment-prefs";

// The real thing, spied on: `router.replace` was tried first and did not clear
// the query string on prod, while its unit test passed. This asserts the call
// that actually erases the flag.
const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});

afterEach(cleanup);
beforeEach(() => replaceState.mockClear());

test("says the profile saved and that no matches come without a city", () => {
  render(<NoCityPrompt />);
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent(/Your profile was saved/i);
  expect(dialog).toHaveTextContent(/won't receive any apartment matches in Swipe/i);
  expect(dialog).toHaveTextContent(/at least one preferred city/i);
});

test("Edit profile links to the form with the preferences banner showing", () => {
  render(<NoCityPrompt />);
  expect(screen.getByRole("link", { name: /edit profile/i })).toHaveAttribute(
    "href",
    FINISH_APARTMENT_PREFS
  );
});

test("Not now closes it and clears the flag, so a refresh does not bring it back", async () => {
  render(<NoCityPrompt />);
  await userEvent.click(screen.getByRole("button", { name: /not now/i }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(replaceState).toHaveBeenCalledWith(null, "", "/swipe");
});

test("Escape dismisses it too", () => {
  render(<NoCityPrompt />);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(replaceState).toHaveBeenCalledWith(null, "", "/swipe");
});

test("so does the backdrop", async () => {
  render(<NoCityPrompt />);
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

/** Two actions and no third: nothing here refuses to let the member move on. */
test("offers exactly the two ways out it promises", () => {
  render(<NoCityPrompt />);
  const dialog = screen.getByRole("dialog");
  expect(screen.getByRole("link", { name: /edit profile/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /not now/i })).toBeInTheDocument();
  // The backdrop's Close button lives outside the panel, so the dialog itself
  // carries just the one button.
  expect(dialog.querySelectorAll("button")).toHaveLength(1);
});

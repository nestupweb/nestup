/**
 * The Daily-life modal on Swipe: a warning, never a gate. It must be
 * dismissible every way a dialog can be, and dismissing must clear the flag
 * from the URL so it does not come back on a refresh.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { DailyLifeReminder } from "@/components/profile/DailyLifeReminder";

// Stubbed, not merely watched: jsdom's History has a brand check that a
// pass-through spy trips ("called on an object that is not a valid instance").
const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});

afterEach(cleanup);
beforeEach(() => replaceState.mockClear());

test("says what was saved and what is missing", () => {
  render(<DailyLifeReminder />);
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent(/Your profile was saved/i);
  expect(dialog).toHaveTextContent(/completing the Daily Life section will improve the quality of your matches/i);
});

test("Edit profile is a link back to the form, not a button that traps them", () => {
  render(<DailyLifeReminder />);
  expect(screen.getByRole("link", { name: /edit profile/i })).toHaveAttribute("href", "/profile/edit");
});

test("Not now closes it and clears the flag, so a refresh does not bring it back", async () => {
  render(<DailyLifeReminder />);
  await userEvent.click(screen.getByRole("button", { name: /not now/i }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(replaceState).toHaveBeenCalledWith(null, "", "/swipe");
});

test("Escape dismisses it too", () => {
  render(<DailyLifeReminder />);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(replaceState).toHaveBeenCalledWith(null, "", "/swipe");
});

test("so does the backdrop", async () => {
  render(<DailyLifeReminder />);
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

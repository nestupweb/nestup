import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

test("is a switch that flips dark theme on <html> and persists to localStorage", async () => {
  render(<ThemeToggle />);
  const sw = screen.getByRole("switch", { name: /dark mode/i });
  expect(sw).toHaveAttribute("aria-checked", "false");
  expect(sw).toHaveAttribute("title", "Switch to dark mode");
  await userEvent.click(sw);
  expect(sw).toHaveAttribute("aria-checked", "true");
  expect(sw).toHaveAttribute("title", "Switch to light mode");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.theme).toBe("dark");
  await userEvent.click(sw);
  expect(sw).toHaveAttribute("aria-checked", "false");
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(localStorage.theme).toBe("light");
});

test("syncs its state when the page loads already in dark mode", async () => {
  document.documentElement.dataset.theme = "dark";
  render(<ThemeToggle />);
  expect(await screen.findByRole("switch", { checked: true })).toBeInTheDocument();
});

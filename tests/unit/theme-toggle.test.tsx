import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

test("toggles dark theme on <html> and persists to localStorage", async () => {
  render(<ThemeToggle />);
  const button = screen.getByRole("button", { name: /switch to dark mode/i });
  await userEvent.click(button);
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.theme).toBe("dark");
  await userEvent.click(screen.getByRole("button", { name: /switch to light mode/i }));
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(localStorage.theme).toBe("light");
});

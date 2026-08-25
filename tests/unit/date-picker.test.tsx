import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { DatePicker, formatISODate, parseISODate, toISODate } from "@/components/ui/DatePicker";

afterEach(cleanup);

test("ISO helpers", () => {
  expect(toISODate(2026, 10, 1)).toBe("2026-10-01");
  expect(parseISODate("2026-10-01")).toEqual({ y: 2026, m: 10, d: 1 });
  expect(parseISODate("2026-13-01")).toBeNull();
  expect(parseISODate("1 Oct")).toBeNull();
  expect(formatISODate("2026-10-01")).toBe("Thu, 1 Oct 2026");
});

test("opens a calendar, picks a day, and submits it through the hidden input", async () => {
  render(
    <form aria-label="f">
      <DatePicker name="available_from" defaultValue="2026-10-01" />
    </form>
  );
  const trigger = screen.getByRole("button", { name: "Thu, 1 Oct 2026" });
  expect(document.querySelector('input[name="available_from"]')).toHaveValue("2026-10-01");

  await userEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "Choose a date" })).toBeInTheDocument();
  expect(screen.getByText("October 2026")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Friday, 9 October 2026" }));
  expect(document.querySelector('input[name="available_from"]')).toHaveValue("2026-10-09");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); // closes after picking
  expect(screen.getByRole("button", { name: "Fri, 9 Oct 2026" })).toBeInTheDocument();
});

test("blocks days before min and days outside the allowed weekdays", async () => {
  render(<DatePicker inline value="2026-10-05" min="2026-10-05" allowedWeekdays={[0, 1, 2]} />);
  // 5 Oct 2026 is a Monday
  expect(screen.getByRole("button", { name: "Sunday, 4 October 2026" })).toBeDisabled(); // before min
  expect(screen.getByRole("button", { name: "Monday, 5 October 2026" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Wednesday, 7 October 2026" })).toBeDisabled(); // not allowed
  expect(screen.getByRole("button", { name: "Sunday, 11 October 2026" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Monday, 5 October 2026" })).toHaveAttribute("aria-pressed", "true");
});

test("month navigation and clear", async () => {
  render(<DatePicker name="d" defaultValue="2026-10-01" clearable />);
  await userEvent.click(screen.getByRole("button", { name: "Thu, 1 Oct 2026" }));
  await userEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(screen.getByText("November 2026")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(document.querySelector('input[name="d"]')).toHaveValue("");
});

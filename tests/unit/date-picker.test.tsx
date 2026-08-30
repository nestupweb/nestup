import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { DatePicker, formatISODate, parseDMY, parseISODate, toDMY, toISODate } from "@/components/ui/DatePicker";

afterEach(cleanup);

test("ISO helpers", () => {
  expect(toISODate(2026, 10, 1)).toBe("2026-10-01");
  expect(parseISODate("2026-10-01")).toEqual({ y: 2026, m: 10, d: 1 });
  expect(parseISODate("2026-13-01")).toBeNull();
  expect(parseISODate("1 Oct")).toBeNull();
  expect(formatISODate("2026-10-01")).toBe("Thu, 1 Oct 2026");
  expect(toDMY("2026-10-01")).toBe("01/10/2026");
  expect(toDMY("")).toBe("");
});

test("parseDMY takes real dd/mm/yyyy dates and refuses impossible ones", () => {
  expect(parseDMY("01/10/2026")).toBe("2026-10-01");
  expect(parseDMY("1/9/2026")).toBe("2026-09-01"); // single digits are fine
  expect(parseDMY(" 05/09/2026 ")).toBe("2026-09-05");
  expect(parseDMY("29/02/2024")).toBe("2024-02-29"); // leap year

  // The whole point: none of these may roll forward into a neighbouring month.
  expect(parseDMY("45/13/2011")).toBeNull();
  expect(parseDMY("32/01/2026")).toBeNull();
  expect(parseDMY("01/13/2026")).toBeNull();
  expect(parseDMY("31/04/2026")).toBeNull(); // April has 30
  expect(parseDMY("29/02/2025")).toBeNull(); // not a leap year
  expect(parseDMY("00/10/2026")).toBeNull();
  expect(parseDMY("01/00/2026")).toBeNull();
  expect(parseDMY("01/10/26")).toBeNull(); // wants four-digit years
  expect(parseDMY("2026-10-01")).toBeNull();
  expect(parseDMY("tomorrow")).toBeNull();
  expect(parseDMY("")).toBeNull();
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

test("a date typed as dd/mm/yyyy is accepted, and a bogus one is refused", async () => {
  render(
    <form aria-label="f" onSubmit={(e) => e.preventDefault()}>
      <DatePicker name="move_in_by" placeholder="Any date" />
    </form>
  );
  await userEvent.click(screen.getByRole("button", { name: "Any date" }));
  const box = screen.getByLabelText("Type a date as dd/mm/yyyy");

  // A real date fills the field in and moves the calendar to that month.
  await userEvent.type(box, "09/10/2026");
  expect(document.querySelector('input[name="move_in_by"]')).toHaveValue("2026-10-09");
  expect(screen.getByText("October 2026")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();

  // The one the user asked about: nothing is stored and the calendar stays put.
  await userEvent.clear(box);
  await userEvent.type(box, "45/13/2011");
  expect(screen.getByRole("alert")).toHaveTextContent("Not a real date");
  expect(document.querySelector('input[name="move_in_by"]')).toHaveValue("2026-10-09");
  expect(screen.getByText("October 2026")).toBeInTheDocument();

  // Enter on a good one commits it and closes the calendar.
  await userEvent.clear(box);
  await userEvent.type(box, "3/12/2026{Enter}");
  expect(document.querySelector('input[name="move_in_by"]')).toHaveValue("2026-12-03");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Thu, 3 Dec 2026" })).toBeInTheDocument();
});

test("typing refuses a date the calendar itself blocks", async () => {
  render(<DatePicker name="d" min="2026-10-05" placeholder="Any date" />);
  await userEvent.click(screen.getByRole("button", { name: "Any date" }));
  await userEvent.type(screen.getByLabelText("Type a date as dd/mm/yyyy"), "01/10/2026");
  expect(screen.getByRole("alert")).toHaveTextContent("can't be picked here");
  expect(document.querySelector('input[name="d"]')).toHaveValue("");
});

test("the inline calendar has no typing box", () => {
  render(<DatePicker inline value="2026-10-05" />);
  expect(screen.queryByLabelText("Type a date as dd/mm/yyyy")).not.toBeInTheDocument();
});

test("month navigation and clear", async () => {
  render(<DatePicker name="d" defaultValue="2026-10-01" clearable />);
  await userEvent.click(screen.getByRole("button", { name: "Thu, 1 Oct 2026" }));
  await userEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(screen.getByText("November 2026")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(document.querySelector('input[name="d"]')).toHaveValue("");
});

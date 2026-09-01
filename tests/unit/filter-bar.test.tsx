import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

const push = vi.fn();
let currentSearch = "city=Haifa";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(currentSearch),
  usePathname: () => "/browse",
}));

import { FilterBar } from "@/components/listings/FilterBar";

test("submits chosen filters into the URL and resets page", async () => {
  render(<FilterBar />);
  expect(screen.getByLabelText(/city/i)).toHaveValue("Haifa"); // initialized from URL
  await userEvent.type(screen.getByLabelText(/max rent/i), "3000");
  await userEvent.click(screen.getByRole("checkbox", { name: /pets allowed/i }));
  await userEvent.selectOptions(screen.getByLabelText(/for how long/i), "half_year");
  await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));
  expect(push).toHaveBeenCalledTimes(1);
  const url = String(push.mock.calls[0][0]);
  expect(url).toContain("city=Haifa");
  expect(url).toContain("rent_max=3000");
  expect(url).toContain("pets_allowed=true");
  expect(url).toContain("lease_term=half_year");
  expect(url).not.toContain("page=");
});

test("'for how long' follows the URL after a navigation, not just on first render", () => {
  cleanup();
  currentSearch = "lease_term=year";
  const { rerender } = render(<FilterBar />);
  const select = screen.getByLabelText(/for how long/i) as HTMLSelectElement;
  expect(select).toHaveValue("year");
  select.form?.reset(); // what React does after the form action runs
  currentSearch = "lease_term=three_months";
  rerender(<FilterBar />);
  expect(screen.getByLabelText(/for how long/i)).toHaveValue("three_months");
  currentSearch = "";
  rerender(<FilterBar />);
  expect(screen.getByLabelText(/for how long/i)).toHaveValue("");
});

/**
 * "All roommates of the same gender" used to be impossible to switch off once
 * applied: the box read `checked` from the tick state OR the URL, so unticking
 * cleared the state, the URL still said "male", and it sprang back on with the
 * dropdown still submitting the filter.
 */
test("an applied same-gender filter can be unticked again", async () => {
  cleanup();
  push.mockClear();
  currentSearch = "household_gender=male";
  render(<FilterBar />);

  const box = screen.getByRole("checkbox", { name: /all roommates of the same gender/i });
  expect(box).toBeChecked(); // the applied filter is reflected
  expect(screen.getByLabelText(/which gender/i)).toHaveValue("male");

  await userEvent.click(box);
  expect(box).not.toBeChecked();
  // The dropdown goes with it, so nothing can submit the filter behind the tick.
  expect(screen.queryByLabelText(/which gender/i)).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));
  expect(String(push.mock.calls[0][0])).not.toContain("household_gender");
});

test("the tick offers exactly two genders, male first", async () => {
  cleanup();
  currentSearch = "";
  render(<FilterBar />);
  await userEvent.click(screen.getByRole("checkbox", { name: /all roommates of the same gender/i }));
  const select = screen.getByLabelText(/which gender/i) as HTMLSelectElement;
  // The tick above already says "All roommates of the same gender", so the
  // options are just the gender (user decision, 2026-09-01) — "All male" under
  // that heading said "all" twice.
  expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
    ["male", "Male"],
    ["female", "Female"],
  ]);
  expect(select).toHaveValue("male");
});

/**
 * "Clear filters" (user request, 2026-09-01): empty the fields and show the
 * unfiltered Listings again.
 */
test("clear filters empties the URL, keeping only sort and view", async () => {
  cleanup();
  push.mockClear();
  currentSearch = "city=Haifa&rent_max=3000&pets_allowed=true&sort=newest&view=map";
  render(<FilterBar />);

  await userEvent.click(screen.getByRole("button", { name: /clear filters/i }));
  expect(push).toHaveBeenCalledTimes(1);
  const url = String(push.mock.calls[0][0]);
  // How the member is reading the page is not something they filtered by.
  expect(url).toContain("sort=newest");
  expect(url).toContain("view=map");
  expect(url).not.toContain("city=");
  expect(url).not.toContain("rent_max=");
  expect(url).not.toContain("pets_allowed=");
});

test("clear filters with nothing to keep goes to plain /browse", async () => {
  cleanup();
  push.mockClear();
  currentSearch = "city=Haifa";
  render(<FilterBar />);
  await userEvent.click(screen.getByRole("button", { name: /clear filters/i }));
  expect(push).toHaveBeenCalledWith("/browse");
});

/**
 * The fields are uncontrolled and `AmountInput` keeps its digits in state of
 * its own, so neither a re-render nor `form.reset()` blanks them. Clearing
 * while already unfiltered — typed but never applied — pushes the URL it is
 * already on, so the remount is the only thing that empties the boxes.
 */
test("clear filters empties typed values even when the URL cannot change", async () => {
  cleanup();
  push.mockClear();
  currentSearch = "";
  render(<FilterBar />);

  await userEvent.type(screen.getByLabelText(/max rent/i), "3000");
  await userEvent.type(screen.getByLabelText(/max roommates/i), "2");
  await userEvent.click(screen.getByRole("checkbox", { name: /pets allowed/i }));
  await userEvent.click(screen.getByRole("checkbox", { name: /all roommates of the same gender/i }));
  expect(screen.getByLabelText(/max rent/i)).toHaveValue("3,000");

  await userEvent.click(screen.getByRole("button", { name: /clear filters/i }));

  expect(screen.getByLabelText(/max rent/i)).toHaveValue("");
  expect(screen.getByLabelText(/max roommates/i)).toHaveValue(null);
  expect(screen.getByRole("checkbox", { name: /pets allowed/i })).not.toBeChecked();
  // The tick is component state, not a form field — it has to go too.
  expect(screen.getByRole("checkbox", { name: /all roommates of the same gender/i })).not.toBeChecked();
  expect(screen.queryByLabelText(/which gender/i)).toBeNull();
});

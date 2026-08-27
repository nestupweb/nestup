import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
let search = "city=Haifa&page=3";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/browse",
}));

import { SortMenu } from "@/components/listings/SortMenu";
import { FilterBar } from "@/components/listings/FilterBar";

beforeEach(() => push.mockClear());

test("picking a price order writes ?sort=, keeps the city and resets the page", async () => {
  render(<SortMenu value="newest" />);
  const trigger = screen.getByRole("button", { name: "Sort: Newest" });
  expect(screen.queryByRole("menu")).toBeNull();
  await userEvent.click(trigger);
  const items = screen.getAllByRole("menuitemradio");
  expect(items.map((i) => i.textContent)).toEqual(["Newest", "Price: high to low", "Price: low to high"]);
  expect(items[0]).toHaveAttribute("aria-checked", "true");
  await userEvent.click(screen.getByRole("menuitemradio", { name: /high to low/i }));
  expect(push).toHaveBeenCalledWith("/browse?city=Haifa&sort=price_desc");
  expect(screen.queryByRole("menu")).toBeNull();
});

test("going back to Newest drops the param; Escape closes the menu", async () => {
  search = "sort=price_asc";
  render(<SortMenu value="price_asc" />);
  await userEvent.click(screen.getByRole("button", { name: "Sort: Price: low to high" }));
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Sort: Price: low to high" }));
  await userEvent.click(screen.getByRole("menuitemradio", { name: /newest/i }));
  expect(push).toHaveBeenCalledWith("/browse");
});

test("applying filters keeps the chosen sort", async () => {
  search = "sort=price_desc";
  render(<FilterBar />);
  await userEvent.type(screen.getByLabelText(/max rent/i), "3000");
  await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));
  const url = String(push.mock.calls[0][0]);
  expect(url).toContain("sort=price_desc");
  expect(url).toContain("rent_max=3000");
});

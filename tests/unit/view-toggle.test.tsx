import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
let search = "city=Haifa&page=3";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/browse",
}));

import { ViewToggle } from "@/components/listings/ViewToggle";
import { FilterBar } from "@/components/listings/FilterBar";

afterEach(cleanup);

beforeEach(() => {
  push.mockClear();
  search = "city=Haifa&page=3";
});

test("switching to the map keeps the filters and drops the page number", async () => {
  render(<ViewToggle value="list" />);
  const list = screen.getByRole("button", { name: "List" });
  const map = screen.getByRole("button", { name: "Map" });
  expect(list).toHaveAttribute("aria-pressed", "true");
  expect(map).toHaveAttribute("aria-pressed", "false");

  await userEvent.click(map);
  expect(push).toHaveBeenCalledWith("/browse?city=Haifa&view=map");
});

test("switching back to the list drops the parameter entirely", async () => {
  search = "view=map";
  render(<ViewToggle value="map" />);
  await userEvent.click(screen.getByRole("button", { name: "List" }));
  expect(push).toHaveBeenCalledWith("/browse");
});

test("picking the view you are already on does nothing", async () => {
  render(<ViewToggle value="list" />);
  await userEvent.click(screen.getByRole("button", { name: "List" }));
  expect(push).not.toHaveBeenCalled();
});

test("applying filters keeps you on the map", async () => {
  search = "view=map&sort=price_desc";
  render(<FilterBar />);
  await userEvent.type(screen.getByLabelText(/max rent/i), "3000");
  await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));
  const url = String(push.mock.calls[0][0]);
  expect(url).toContain("view=map");
  expect(url).toContain("sort=price_desc");
  expect(url).toContain("rent_max=3000");
});

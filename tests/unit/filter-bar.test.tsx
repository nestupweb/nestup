import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("city=Haifa"),
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

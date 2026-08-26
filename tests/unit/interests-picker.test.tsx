import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { InterestsPicker } from "@/components/profile/InterestsPicker";
import { MAX_INTERESTS } from "@/lib/constants";

test("toggles interests and enforces the max", async () => {
  render(<InterestsPicker initial={["Music"]} />);
  expect(screen.getByRole("checkbox", { name: "Music" })).toBeChecked();

  await userEvent.click(screen.getByRole("checkbox", { name: "Cooking" }));
  expect(screen.getByRole("checkbox", { name: "Cooking" })).toBeChecked();

  // check up to the cap, then two more must stay unchecked
  const boxes = screen.getAllByRole("checkbox");
  let clicks = 0;
  for (const box of boxes) {
    if ((box as HTMLInputElement).checked) continue;
    await userEvent.click(box);
    if (++clicks >= MAX_INTERESTS) break; // enough to pass the cap by two
  }
  const checked = boxes.filter((b) => (b as HTMLInputElement).checked);
  expect(checked.length).toBe(MAX_INTERESTS);
  expect(screen.getByText(new RegExp(`${MAX_INTERESTS} selected`))).toBeInTheDocument();
}, 20_000);

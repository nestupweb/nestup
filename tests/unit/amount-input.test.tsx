import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { AmountInput } from "@/components/ui/AmountInput";

afterEach(cleanup);

/** What the form would actually submit for `name`. */
const submitted = (name: string) =>
  new FormData(screen.getByTestId("form") as HTMLFormElement).get(name);

const field = (
  <form data-testid="form">
    <label>
      Rent (₪ / month)
      <AmountInput name="rent" />
    </label>
  </form>
);

test("groups thousands as you type, and submits the bare number", async () => {
  render(field);
  const box = screen.getByLabelText(/rent/i);

  await userEvent.type(box, "4500");
  expect(box).toHaveValue("4,500");
  expect(submitted("rent")).toBe("4500");

  await userEvent.type(box, "0");
  expect(box).toHaveValue("45,000");
  expect(submitted("rent")).toBe("45000");
});

test("shows an existing rent already grouped", () => {
  render(
    <form data-testid="form">
      <label>
        Rent (₪ / month)
        <AmountInput name="rent" defaultValue={12000} />
      </label>
    </form>,
  );
  expect(screen.getByLabelText(/rent/i)).toHaveValue("12,000");
  expect(submitted("rent")).toBe("12000");
});

test("ignores anything that isn't a digit", async () => {
  render(field);
  const box = screen.getByLabelText(/rent/i);

  await userEvent.type(box, "a3b,c-.5 0 0");
  expect(box).toHaveValue("3,500");
  expect(submitted("rent")).toBe("3500");
});

test("an empty field submits nothing, not a zero", async () => {
  render(field);
  const box = screen.getByLabelText(/rent/i);

  await userEvent.type(box, "900");
  await userEvent.clear(box);
  expect(box).toHaveValue("");
  expect(submitted("rent")).toBe("");
});

test("the caret stays put when a comma appears to its left", async () => {
  render(field);
  const box = screen.getByLabelText(/rent/i) as HTMLInputElement;

  // Typing the digit that pushes "500" over into "4,500" must not drop the
  // caret behind the new comma, or the next keystroke lands in the wrong place.
  await userEvent.type(box, "500");
  expect(box).toHaveValue("500");
  await userEvent.type(box, "0");
  expect(box).toHaveValue("5,000");
  expect(box.selectionStart).toBe(5); // end of "5,000", not 4

  // ...and inserting in the middle keeps the caret on the digit just typed.
  await userEvent.type(box, "9", { initialSelectionStart: 0, initialSelectionEnd: 0 });
  expect(box).toHaveValue("95,000");
  expect(box.selectionStart).toBe(1);
});

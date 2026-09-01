import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ContactRow } from "@/components/profile/ContactRow";

afterEach(cleanup);

/**
 * `public_profile_details` returns NULL — not "" — for a detail the member
 * chose not to publish (`case when d.show_phone then d.phone else null end`).
 * A default parameter covers `undefined` and not `null`, so every one of these
 * used to reach `.trim()` as null and take the whole /people/[id] render down
 * with "Cannot read properties of null (reading 'trim')".
 */
test("a hidden phone arrives as null and is simply not shown", () => {
  render(<ContactRow instagram="@dana" phone={null} email="dana@example.com" />);
  expect(screen.getByLabelText("Contact")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /open instagram profile/i })).toBeInTheDocument();
  expect(screen.getByText("dana@example.com")).toBeInTheDocument();
  expect(screen.queryByText(/\+972/)).not.toBeInTheDocument();
});

test("every field null renders nothing at all, like every field empty", () => {
  const { container } = render(
    <ContactRow instagram={null} facebook={null} linkedin={null} phone={null} email={null} />
  );
  expect(container).toBeEmptyDOMElement();
});

test("null and undefined and \"\" are treated the same way", () => {
  const { container: nulls } = render(<ContactRow phone={null} email={null} />);
  const { container: undef } = render(<ContactRow />);
  const { container: empty } = render(<ContactRow phone="" email="" />);
  expect(nulls.innerHTML).toBe(undef.innerHTML);
  expect(nulls.innerHTML).toBe(empty.innerHTML);
});

test("the details that are there still render", () => {
  render(<ContactRow instagram="@dana" facebook={null} linkedin={null} phone="+972 50-123-4567" email={null} />);
  expect(screen.getByRole("link", { name: /open instagram profile/i })).toBeInTheDocument();
  expect(screen.getByText("+972 50-123-4567")).toBeInTheDocument();
});

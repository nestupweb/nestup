import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const setSavedAction = vi.fn(async () => ({ ok: true }));
vi.mock("@/app/actions/saved", () => ({ setSavedAction: (...a: unknown[]) => setSavedAction(...(a as [])) }));

import { SaveButton } from "@/components/listings/SaveButton";

afterEach(cleanup);

test("visitors get no heart at all — liking needs an account", () => {
  const { container } = render(<SaveButton listingId="l1" signedIn={false} />);
  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByRole("button")).toBeNull();
});

test("signed-in members get the heart, hollow until liked", () => {
  render(<SaveButton listingId="l1" signedIn />);
  expect(screen.getByRole("button", { name: "Like this room" })).toHaveAttribute("aria-pressed", "false");
});

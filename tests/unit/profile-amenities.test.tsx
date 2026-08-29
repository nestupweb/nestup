import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { ProfileFormState } from "@/app/actions/profile";

const save = vi.fn<(prev: ProfileFormState, data: FormData) => Promise<ProfileFormState>>();
vi.mock("@/app/actions/profile", () => ({
  upsertProfileAction: (prev: ProfileFormState, data: FormData) => save(prev, data),
}));

import { ProfileForm } from "@/components/profile/ProfileForm";

afterEach(cleanup);

/**
 * Amenities — the room's own features — live in one block under Apartment
 * preferences, and the mamad lives there with them.
 */
test("the mamad is asked about once, in Amenities", () => {
  render(<ProfileForm profile={null} onboarding />);

  // Exactly one control, not one here and another in Daily life.
  const mamads = screen.getAllByLabelText(/mamad/i);
  expect(mamads).toHaveLength(1);
  expect(mamads[0]).toHaveValue("any");

  // ...and it sits inside the Amenities block, next to the tick boxes.
  const block = screen.getByText(/^Amenities/).closest("div")!;
  expect(block).toContainElement(mamads[0]);
  for (const label of ["Balcony", "Air conditioning", "Parking", "Elevator", "Furnished"]) {
    expect(screen.getByRole("checkbox", { name: label })).not.toBeChecked();
  }
});

test("what was ticked is what gets sent", async () => {
  save.mockResolvedValue({});
  render(<ProfileForm profile={null} onboarding />);

  // The browser won't submit until the required fields are filled.
  await userEvent.type(screen.getByLabelText(/full name/i), "Dana Levi");
  await userEvent.type(screen.getByLabelText(/^age/i), "27");
  await userEvent.type(screen.getByLabelText(/occupation/i), "Nurse");
  await userEvent.type(document.querySelector<HTMLInputElement>('input[name="bio"]')!, "Plant person.");

  await userEvent.selectOptions(screen.getByLabelText(/mamad/i), "building");
  await userEvent.click(screen.getByRole("checkbox", { name: "Balcony" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Parking" }));
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  await waitFor(() => expect(save).toHaveBeenCalled(), { timeout: 8000 });
  const data = save.mock.calls.at(-1)![1];
  expect(data.get("pref_safe_room")).toBe("building");
  expect(data.getAll("pref_amenities")).toEqual(["balcony", "parking"]);
});

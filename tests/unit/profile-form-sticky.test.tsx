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
 * The onboarding form new members meet right after signing up. It is long, so
 * a rejected save that emptied it was the worst version of this bug.
 */
test("a rejected onboarding save leaves everything already filled in place", async () => {
  save.mockResolvedValue({ error: "preferred_cities: pick at least one city" });
  render(<ProfileForm profile={null} onboarding />);

  await userEvent.type(screen.getByLabelText(/full name/i), "Dana Levi");
  await userEvent.type(screen.getByLabelText(/^age/i), "27");
  await userEvent.selectOptions(screen.getByLabelText(/^gender/i), "female");
  await userEvent.type(screen.getByLabelText(/occupation/i), "Nurse");
  const bio = document.querySelector<HTMLInputElement>('input[name="bio"]')!;
  await userEvent.type(bio, "Early riser, plant person.");
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/pick at least one city/), { timeout: 8000 });
  expect(screen.getByLabelText(/full name/i)).toHaveValue("Dana Levi");
  expect(screen.getByLabelText(/^age/i)).toHaveValue(27);
  expect(screen.getByLabelText(/occupation/i)).toHaveValue("Nurse");
  expect(bio).toHaveValue("Early riser, plant person.");
});

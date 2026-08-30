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

/** Fills the four the form will not save without. */
async function fillBasics() {
  await userEvent.type(screen.getByLabelText(/full name/i), "Dana Levi");
  await userEvent.type(screen.getByLabelText(/^age/i), "27");
  await userEvent.selectOptions(screen.getByLabelText(/^gender/i), "female");
  await userEvent.type(screen.getByLabelText(/occupation/i), "Nurse");
}

test("name, age, gender and occupation are all required in the browser too", () => {
  render(<ProfileForm profile={null} onboarding />);

  expect(screen.getByLabelText(/full name/i)).toBeRequired();
  expect(screen.getByLabelText(/^age/i)).toBeRequired();
  expect(screen.getByLabelText(/^gender/i)).toBeRequired();
  expect(screen.getByLabelText(/occupation/i)).toBeRequired();
  // Gender opens on nothing: it is asked, never guessed.
  expect(screen.getByLabelText(/^gender/i)).toHaveValue("");
});

test("a save refused for missing basics marks each field and says why", async () => {
  save.mockResolvedValue({
    error: "Some required details are missing — check the highlighted fields below.",
    fieldErrors: { gender: "Choose your gender.", occupation: "Tell us what you do." },
  });
  render(<ProfileForm profile={null} onboarding />);
  await fillBasics();
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  await waitFor(() => expect(screen.getByText("Choose your gender.")).toBeInTheDocument(), { timeout: 8000 });
  expect(screen.getByText("Tell us what you do.")).toBeInTheDocument();

  // The message is tied to the field it belongs to, and the field says it failed.
  const occupation = screen.getByLabelText(/occupation/i);
  expect(occupation).toHaveAttribute("aria-invalid", "true");
  expect(occupation).toHaveAttribute("aria-describedby", "occupation-error");
  expect(screen.getByLabelText(/^gender/i)).toHaveAttribute("aria-invalid", "true");
  // Nothing is pinned on the fields that were fine.
  expect(screen.getByLabelText(/full name/i)).not.toHaveAttribute("aria-invalid");
});

/**
 * The Daily life table stopped being mandatory (2026-08-30). Saving one that is
 * half-answered succeeds; what it earns is a warning where the member is
 * looking — directly above the button they just pressed.
 */
test("an unfinished Daily life table warns above Save instead of blocking", async () => {
  save.mockResolvedValue({ savedWithDailyLifeGaps: true });
  render(<ProfileForm profile={null} onboarding />);
  await fillBasics();
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  const warning = await screen.findByRole("status", {}, { timeout: 8000 });
  expect(warning).toHaveTextContent(
    "Your profile was saved, but completing the Daily Life section will improve the quality of your matches."
  );
  // Directly above the Save button, and not dressed as a failure.
  expect(warning.nextElementSibling).toBe(screen.getByRole("button", { name: "Save profile" }));
  expect(screen.queryByRole("alert")).toBeNull();
});

/** Arriving from /swipe, the form says which preferences are still empty. */
test("the Swipe gate's reason is repeated on the form", () => {
  render(<ProfileForm profile={null} onboarding needsApartmentPrefs />);

  const banner = screen.getByRole("status");
  expect(banner).toHaveTextContent(/monthly budget, preferred cities and earliest move-in/i);
  expect(banner).toHaveTextContent(/amenities are optional/i);
});

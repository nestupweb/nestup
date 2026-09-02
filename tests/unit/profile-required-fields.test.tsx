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
 * The Daily life table stopped being mandatory (2026-08-30), and since
 * 2026-09-02 the "saved, but…" note lives on the profile page only — never on
 * this form. Save ends the form; a note left sitting on it read as a failure.
 */
test("an unfinished Daily life table shows no note on the form", async () => {
  save.mockResolvedValue({});
  render(<ProfileForm profile={null} onboarding />);
  await fillBasics();
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText(/Daily Life section/i)).toBeNull();
  // Nothing was dressed as a failure either — the save did work.
  expect(screen.queryByRole("alert")).toBeNull();
});

/** Errors are the one thing that still belongs on the form: they keep you here. */
test("a real error still shows on the form", async () => {
  save.mockResolvedValue({ error: "Could not save your profile. Please try again." });
  render(<ProfileForm profile={null} onboarding />);
  await fillBasics();
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  expect(await screen.findByRole("alert", {}, { timeout: 8000 })).toHaveTextContent(/could not save/i);
});

/** Arriving from /swipe, the form says which preferences are still empty. */
test("the Swipe gate's reason is repeated on the form", () => {
  render(<ProfileForm profile={null} onboarding needsApartmentPrefs />);

  const banner = screen.getByRole("status");
  // Two requirements, not three: the move-in date stopped gating the deck on
  // 2026-09-01 (see lib/apartment-prefs.ts), so the banner must not demand it.
  expect(banner).toHaveTextContent(/monthly budget and preferred cities/i);
  expect(banner).not.toHaveTextContent(/earliest move-in are still empty/i);
  expect(banner).toHaveTextContent(/move-in and amenities are optional/i);
});

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { aboutSchema } from "@/lib/validation/about";
import type { Profile } from "@/lib/types";

afterEach(cleanup);

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={String(src)} alt={String(alt ?? "")} />;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/profile" }));
vi.mock("@/app/actions/about", () => ({ saveAboutAction: vi.fn(async () => ({ saved: true })) }));

import { ProfileTabs } from "@/components/profile/ProfileTabs";

const profile: Profile = {
  user_id: "u1", full_name: "Noa Peretz", age: 26, occupation: "Product designer", bio: "",
  avatar_url: null, smoker: false, has_pet: true, cleanliness: 4, sleep_schedule: "early",
  guests_freq: "sometimes", interests: ["Music", "Cooking", "Yoga"], ok_with_smoker: false,
  ok_with_pets: true, budget_min: 3000, budget_max: 5000, preferred_cities: ["Tel Aviv"],
  earliest_move_in: "2026-10-01", created_at: "", updated_at: "",
};

test("aboutSchema splits languages, validates clock + email, mirrors profile basics", () => {
  const r = aboutSchema.safeParse({
    about: "Hi!", languages: "Hebrew, English; French", wake_time: "07:30", bed_time: "",
    contact_email: "noa@example.com", occupation: "Designer", smoker: false, has_pet: true,
    budget_min: 3000, budget_max: 5000, earliest_move_in: "2026-10-01",
  });
  expect(r.success).toBe(true);
  if (r.success) {
    expect(r.data.languages).toEqual(["Hebrew", "English", "French"]);
    expect(r.data.shabbat).toBe("");
  }
  expect(aboutSchema.safeParse({ about: "", languages: "", wake_time: "7am" }).success).toBe(false);
  expect(aboutSchema.safeParse({ about: "", languages: "", contact_email: "nope" }).success).toBe(false);
  expect(aboutSchema.safeParse({ about: "", languages: "", budget_min: 4000, budget_max: 3000 }).success).toBe(false);
});

test("About me is the first tab, shows the editable section, and hides it on other tabs", async () => {
  render(
    <ProfileTabs
      mine={[]}
      liked={[]}
      history={[]}
      about={{ profile, details: null, email: "noa@example.com" }}
    />
  );
  const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
  expect(tabs[0]).toBe("About me");
  expect(tabs[1]).toContain("My Listings");
  expect(screen.getByRole("tab", { name: "About me" })).toHaveAttribute("aria-selected", "true");

  const intro = screen.getByRole("textbox", { name: /about me/i });
  expect(intro).toBeInTheDocument();
  expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/email address/i)).toHaveValue("noa@example.com");
  expect(screen.getByLabelText(/shabbat observance/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/budget max/i)).toHaveValue(5000);

  await userEvent.click(screen.getByRole("tab", { name: /my listings/i }));
  expect(screen.queryByRole("textbox", { name: /about me/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
  expect(screen.getByText(/no listings yet/i)).toBeInTheDocument();
});

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
  ok_with_pets: true,
    noise_level: "moderate", diet: "none", pref_cleanliness: 1, pref_sleep: "any", pref_guests: "any", pref_noise: "any", pref_diet: "any", shabbat: "", pref_shabbat: "any", chores: [], budget_min: 3000, budget_max: 5000, preferred_cities: ["Tel Aviv"],
  earliest_move_in: "2026-10-01", pref_lease_term: "any", created_at: "", updated_at: "",
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
  expect(tabs[1]).toBe("My listing");
  expect(screen.getByRole("tab", { name: "About me" })).toHaveAttribute("aria-selected", "true");

  const intro = screen.getByRole("textbox", { name: /about me/i });
  expect(intro).toBeInTheDocument();
  expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/email address/i)).toHaveValue("noa@example.com");
  expect(screen.getByLabelText(/shabbat observance/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/budget max/i)).toHaveValue(5000);

  await userEvent.click(screen.getByRole("tab", { name: /my listing/i }));
  expect(screen.queryByRole("textbox", { name: /about me/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /add listing/i })).toHaveAttribute("href", "/listing");
});

test("read-only mode shows the About me section as other members see it — no inputs, no contact info", () => {
  render(
    <ProfileTabs
      mine={[]}
      liked={[]}
      history={[]}
      about={{
        profile,
        details: {
          user_id: "u1", about: "Plants and shakshuka.", languages: ["Hebrew", "English"], diet: "Vegetarian",
          pet_details: "a cat", lifestyle: "WFH", wake_time: "07:30", bed_time: "23:00", shabbat: "traditional",
          cooking: "Most evenings", phone: "050-1234567", contact_email: "noa@example.com",
          instagram: "@noa", facebook: "", linkedin: "", intro_template: "", updated_at: "",
        },
        email: "noa@example.com",
        readOnly: true,
      }}
    />
  );
  expect(screen.getByText("Plants and shakshuka.")).toBeInTheDocument();
  expect(screen.getByText("Hebrew, English")).toBeInTheDocument();
  expect(screen.getByText("7:30")).toBeInTheDocument();
  // Social links live in the page header's ContactRow now, not in the About panel.
  expect(screen.queryByRole("link", { name: /instagram|@noa/i })).toBeNull();
  expect(screen.getByRole("table", { name: "Daily life" })).toBeInTheDocument();
  // "Looking for" (budget / move-in / cities) sits above the Daily life table (user request).
  const lookingFor = screen.getByRole("heading", { name: "Looking for" });
  const dailyLife = screen.getByRole("heading", { name: "Daily life" });
  expect(lookingFor.compareDocumentPosition(dailyLife) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText("₪3,000–₪5,000 / month")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  expect(screen.queryByText("050-1234567")).not.toBeInTheDocument();
  expect(screen.queryByText("noa@example.com")).not.toBeInTheDocument();
});

test("read-only mode with no details points at Edit Profile", () => {
  render(<ProfileTabs mine={[]} liked={[]} history={[]} about={{ profile, details: null, email: "", readOnly: true }} />);
  expect(screen.getByRole("link", { name: /tap Edit Profile/i })).toHaveAttribute("href", "/profile/edit");
  expect(screen.queryByText(/pencil/i)).toBeNull();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

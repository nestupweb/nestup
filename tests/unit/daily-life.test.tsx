import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { BudgetRange, budgetSummary } from "@/components/profile/BudgetRange";
import { DailyLifeFields } from "@/components/profile/DailyLifeFields";
import { SocialLinkInput } from "@/components/profile/SocialLinkInput";
import { dailyLifeRows } from "@/lib/daily-life";
import type { Profile } from "@/lib/types";

afterEach(cleanup);

const me: Profile = {
  user_id: "u1", full_name: "Noa Peretz", age: 26, occupation: "", bio: "", avatar_url: null,
  smoker: false, has_pet: true, cleanliness: 4, sleep_schedule: "early", guests_freq: "sometimes",
  noise_level: "quiet", diet: "vegetarian", interests: [],
  ok_with_smoker: false, ok_with_pets: true, pref_cleanliness: 3, pref_sleep: "any", pref_guests: "sometimes", pref_noise: "quiet", pref_diet: "vegetarian",
  budget_min: 2000, budget_max: 4500, preferred_cities: [], earliest_move_in: null, created_at: "", updated_at: "",
};

test("dailyLifeRows puts every habit in words, my side and the flatmate side", () => {
  const rows = dailyLifeRows(me);
  expect(rows.map((r) => r.label)).toEqual(["Smoking", "Pets", "Cleanliness", "Schedule", "Guests", "Noise", "Dietary restrictions"]);
  expect(rows.find((r) => r.key === "smoking")).toMatchObject({ mine: "Non-smoker", wants: "Non-smokers only" });
  expect(rows.find((r) => r.key === "cleanliness")).toMatchObject({ mine: "4 · Neat", wants: "At least 3 · Tidy enough" });
  expect(rows.find((r) => r.key === "diet")).toMatchObject({ mine: "Vegetarian", wants: "Vegetarian or vegan" });
});

test("the Daily life table submits one control per cell under the names the action reads", () => {
  render(
    <form aria-label="f">
      <DailyLifeFields profile={me} />
    </form>
  );
  const form = screen.getByRole("form", { name: "f" }) as HTMLFormElement;
  const data = new FormData(form);
  expect(data.get("smoker")).toBe(""); // "I don't smoke"
  expect(data.get("has_pet")).toBe("on");
  expect(data.get("ok_with_smoker")).toBe("");
  expect(data.get("cleanliness")).toBe("4");
  expect(data.get("pref_cleanliness")).toBe("3");
  expect(data.get("sleep_schedule")).toBe("early");
  expect(data.get("pref_guests")).toBe("sometimes");
  expect(data.get("noise_level")).toBe("quiet");
  expect(data.get("pref_noise")).toBe("quiet");
  expect(data.get("dietary")).toBe("vegetarian");
  expect(data.get("pref_diet")).toBe("vegetarian");
  expect(screen.getByRole("table", { name: "Daily life" })).toBeInTheDocument();
  expect(screen.getAllByRole("row")).toHaveLength(8); // header + 7 habits
});

test("budgetSummary reads like a sentence and treats max 0 as no maximum", () => {
  expect(budgetSummary(0, 0)).toBe("Any budget");
  expect(budgetSummary(2000, 0)).toBe("From ₪2,000 / month");
  expect(budgetSummary(0, 4500)).toBe("Up to ₪4,500 / month");
  expect(budgetSummary(2000, 4500)).toBe("₪2,000 – ₪4,500 / month");
});

test("BudgetRange: two handles, hidden budget fields, and the top of the track means no max", () => {
  render(
    <form aria-label="b">
      <BudgetRange initialMin={2000} initialMax={4500} />
    </form>
  );
  const form = screen.getByRole("form", { name: "b" }) as HTMLFormElement;
  expect(new FormData(form).get("budget_min")).toBe("2000");
  expect(new FormData(form).get("budget_max")).toBe("4500");

  const min = screen.getByRole("slider", { name: "Minimum budget" });
  const max = screen.getByRole("slider", { name: "Maximum budget" });
  fireEvent.change(max, { target: { value: "15000" } });
  expect(new FormData(form).get("budget_max")).toBe("0"); // parked at the end = no maximum
  expect(screen.getByText("From ₪2,000 / month")).toBeInTheDocument();

  fireEvent.change(min, { target: { value: "14950" } }); // can't cross the max handle
  expect(Number(new FormData(form).get("budget_min"))).toBeLessThanOrEqual(14900);
});

test("SocialLinkInput turns a handle into an opening link, and free text into none", () => {
  render(<SocialLinkInput name="instagram" kind="instagram" label="Instagram" defaultValue="@noa.p" />);
  const link = screen.getByRole("link", { name: "Open Instagram profile" });
  expect(link).toHaveAttribute("href", "https://instagram.com/noa.p");
  expect(link).toHaveAttribute("target", "_blank");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Noa Peretz" } });
  expect(screen.queryByRole("link")).toBeNull();
});

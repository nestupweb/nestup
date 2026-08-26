import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { BudgetRange, budgetSummary } from "@/components/profile/BudgetRange";
import { ChoresPicker } from "@/components/profile/ChoresPicker";
import { ContactRow } from "@/components/profile/ContactRow";
import { DailyLifeFields } from "@/components/profile/DailyLifeFields";
import { DailyLifeView } from "@/components/profile/DailyLifeView";
import { SocialLinkInput } from "@/components/profile/SocialLinkInput";
import { hourChoices, nearestHour } from "@/lib/clock";
import { dailyLifeRows } from "@/lib/daily-life";
import type { Profile } from "@/lib/types";

afterEach(cleanup);

const me: Profile = {
  user_id: "u1", full_name: "Noa Peretz", age: 26, occupation: "", bio: "", avatar_url: null,
  smoker: false, has_pet: true, cleanliness: 4, sleep_schedule: "early", guests_freq: "sometimes",
  noise_level: "quiet", diet: "vegetarian", shabbat: "traditional", interests: [], chores: ["Dishes", "Laundry"],
  ok_with_smoker: false, ok_with_pets: true, pref_cleanliness: 3, pref_sleep: "any", pref_guests: "sometimes", pref_noise: "quiet", pref_diet: "vegetarian", pref_shabbat: "traditional",
  budget_min: 2000, budget_max: 4500, preferred_cities: [], earliest_move_in: null, created_at: "", updated_at: "",
};

test("dailyLifeRows puts every habit in words, my side and the roommate side", () => {
  const rows = dailyLifeRows(me);
  expect(rows.map((r) => r.label)).toEqual(["Smoking", "Pets", "Cleanliness", "Schedule", "Guests", "Noise", "Dietary restrictions", "Shabbat"]);
  expect(rows.find((r) => r.key === "smoking")).toMatchObject({ mine: "Non-smoker", wants: "Non-smokers only" });
  expect(rows.find((r) => r.key === "cleanliness")).toMatchObject({ mine: "4 · Neat", wants: "At least 3 · Tidy enough" });
  expect(rows.find((r) => r.key === "diet")).toMatchObject({ mine: "Vegetarian", wants: "Vegetarian or vegan" });
  expect(rows.find((r) => r.key === "shabbat")).toMatchObject({ mine: "Traditional", wants: "Traditional or observant" });
  expect(dailyLifeRows({ ...me, shabbat: "", pref_shabbat: "any" }).find((r) => r.key === "shabbat")).toMatchObject({
    mine: "Prefer not to say", wants: "No preference",
  });
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
  expect(data.get("shabbat")).toBe("traditional");
  expect(data.get("pref_shabbat")).toBe("traditional");
  expect(screen.getByRole("table", { name: "Daily life" })).toBeInTheDocument();
  expect(screen.getAllByRole("row")).toHaveLength(9); // header + 8 habits
});

test("both tables head the answer columns only: nothing above the habit names", () => {
  render(<DailyLifeView profile={me} />);
  const heads = screen.getAllByRole("columnheader");
  expect(heads.map((h) => h.textContent)).toEqual(["", "My lifestyle", "What I want in roommates"]);
  expect(heads[0]).toHaveAttribute("aria-label", "Habit");
  expect(heads[0]).toHaveClass("hidden", "sm:block"); // present only once the habit column exists
  expect(screen.getByText("Traditional or observant")).toBeInTheDocument();
  expect(screen.queryByText("Roommates")).toBeNull(); // the old per-cell "Me" / "Roommates" captions are gone
  expect(screen.queryByText("Me")).toBeNull();
});

test("ChoresPicker submits every ticked chore under `chores`", () => {
  render(
    <form aria-label="c">
      <ChoresPicker initial={["Dishes"]} />
    </form>
  );
  const form = screen.getByRole("form", { name: "c" }) as HTMLFormElement;
  expect(new FormData(form).getAll("chores")).toEqual(["Dishes"]);
  fireEvent.click(screen.getByRole("checkbox", { name: "Laundry" }));
  expect(new FormData(form).getAll("chores")).toEqual(["Dishes", "Laundry"]);
  fireEvent.click(screen.getByRole("checkbox", { name: "Dishes" }));
  expect(new FormData(form).getAll("chores")).toEqual(["Laundry"]);
  expect(screen.getByText(/1 selected/)).toBeInTheDocument();
});

test("wake-up / bedtime are approximate full hours and optional", () => {
  expect(nearestHour("07:29")).toBe("07:00");
  expect(nearestHour("07:30")).toBe("08:00");
  expect(nearestHour("23:45")).toBe("00:00");
  expect(nearestHour("")).toBe("");
  expect(nearestHour("7am")).toBe("");
  expect(hourChoices(["06:00", "07:00"], "")).toEqual(["06:00", "07:00"]);
  expect(hourChoices(["06:00", "07:00"], "07:00")).toEqual(["06:00", "07:00"]);
  expect(hourChoices(["06:00", "07:00"], "14:00")).toEqual(["06:00", "07:00", "14:00"]); // legacy value stays selectable
});

test("ContactRow: social links open in a new tab, free text shows as a plain chip, phone/e-mail only when given", () => {
  const { container } = render(<ContactRow instagram="@noa.p" facebook="Noa Peretz" phone="050 123 4567" email="noa@example.com" />);
  const ig = screen.getByRole("link", { name: "Open Instagram profile" });
  expect(ig).toHaveAttribute("href", "https://instagram.com/noa.p");
  expect(ig).toHaveAttribute("target", "_blank");
  expect(screen.getByText("Noa Peretz")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Open Facebook profile" })).toBeNull();
  expect(screen.getByRole("link", { name: /050 123 4567/ })).toHaveAttribute("href", "tel:0501234567");
  expect(screen.getByRole("link", { name: /noa@example.com/ })).toHaveAttribute("href", "mailto:noa@example.com");
  expect(container.querySelectorAll("a, span.inline-flex")).not.toHaveLength(0);
  cleanup();
  const empty = render(<ContactRow />);
  expect(empty.container).toBeEmptyDOMElement();
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

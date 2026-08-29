import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { BudgetRange, budgetSummary } from "@/components/profile/BudgetRange";
import { ChoresPicker } from "@/components/profile/ChoresPicker";
import { ContactRow } from "@/components/profile/ContactRow";
import { DailyLifeFields } from "@/components/profile/DailyLifeFields";
import { DailyLifeView } from "@/components/profile/DailyLifeView";
import { SocialLinkInput } from "@/components/profile/SocialLinkInput";
import { hourChoices, nearestHour } from "@/lib/clock";
import { dailyLifeRows, isDailyLifeComplete, unansweredCount, withDailyLifeDefaults } from "@/lib/daily-life";
import type { Profile } from "@/lib/types";

afterEach(cleanup);

const me: Profile = {
  user_id: "u1", full_name: "Noa Peretz", age: 26, occupation: "", bio: "", avatar_url: null,
  smoker: false, has_pet: true, cleanliness: 4, sleep_schedule: "early", guests_freq: "sometimes",
  noise_level: "quiet", diet: "vegetarian", shabbat: "traditional", interests: [], chores: ["Dishes", "Laundry"],
  ok_with_smoker: false, ok_with_pets: true, pref_cleanliness: 3, pref_sleep: "any", pref_guests: "sometimes", pref_noise: "quiet", pref_diet: "vegetarian", pref_shabbat: "traditional",
  budget_min: 2000, budget_max: 4500, preferred_cities: [], earliest_move_in: null, pref_lease_term: "any", pref_safe_room: "any", notify_new_matches: false, created_at: "", updated_at: "",
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

test("an unanswered row reads as a dash, and a plain No still reads as No", () => {
  const blank = { ...me, smoker: null, ok_with_smoker: null, cleanliness: null, sleep_schedule: null,
    guests_freq: null, noise_level: null, diet: null, shabbat: null, pref_cleanliness: null,
    pref_sleep: null, pref_guests: null, pref_noise: null, pref_diet: null, pref_shabbat: null } as Profile;
  const rows = dailyLifeRows(blank);
  expect(rows.find((r) => r.key === "smoking")).toMatchObject({ mine: "—", wants: "—" });
  expect(rows.find((r) => r.key === "cleanliness")).toMatchObject({ mine: "—", wants: "—" });
  expect(rows.find((r) => r.key === "shabbat")).toMatchObject({ mine: "—", wants: "—" });
  // has_pet is still `true` here: only the nulls turn into dashes.
  expect(rows.find((r) => r.key === "pets")).toMatchObject({ mine: "Has a pet" });
  // …and `false` is an answer, not a blank.
  expect(dailyLifeRows({ ...blank, smoker: false }).find((r) => r.key === "smoking")).toMatchObject({ mine: "Non-smoker" });
});

test("a member who never answered opens the table empty, and can still submit it", () => {
  const blank = { ...me, smoker: null, has_pet: null, cleanliness: null, sleep_schedule: null,
    guests_freq: null, noise_level: null, diet: null, shabbat: null, ok_with_smoker: null,
    ok_with_pets: null, pref_cleanliness: null, pref_sleep: null, pref_guests: null,
    pref_noise: null, pref_diet: null, pref_shabbat: null } as Profile;
  render(
    <form aria-label="blank">
      <DailyLifeFields profile={blank} />
    </form>
  );
  const data = new FormData(screen.getByRole("form", { name: "blank" }) as HTMLFormElement);
  for (const name of ["smoker", "has_pet", "ok_with_smoker", "ok_with_pets", "cleanliness",
    "pref_cleanliness", "sleep_schedule", "pref_sleep", "guests_freq", "pref_guests",
    "noise_level", "pref_noise", "dietary", "pref_diet", "shabbat", "pref_shabbat"]) {
    expect(data.get(name), name).toBe("");
  }
});

test("Shabbat keeps 'Prefer not to say' distinct from not having answered", () => {
  render(
    <form aria-label="s">
      <DailyLifeFields profile={{ ...me, shabbat: "" } as Profile} />
    </form>
  );
  // The column stores "", but a select cannot tell two blank options apart, so
  // the chosen one travels as a word.
  expect(new FormData(screen.getByRole("form", { name: "s" }) as HTMLFormElement).get("shabbat")).toBe("prefer_not_to_say");
});

test("the Daily life table submits one control per cell under the names the action reads", () => {
  render(
    <form aria-label="f">
      <DailyLifeFields profile={me} />
    </form>
  );
  const form = screen.getByRole("form", { name: "f" }) as HTMLFormElement;
  const data = new FormData(form);
  // "no" and "yes", never "" — the blank is reserved for "not answered" (0035).
  expect(data.get("smoker")).toBe("no");
  expect(data.get("has_pet")).toBe("yes");
  expect(data.get("ok_with_smoker")).toBe("no");
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

/**
 * What the swipe deck asks before it opens (migration 0035). The deck ranks
 * every room against these answers, so an unfinished table would sort by
 * values the member never chose.
 */
test("isDailyLifeComplete wants all sixteen answers, and counts what's left", () => {
  expect(isDailyLifeComplete(me)).toBe(true);
  expect(unansweredCount(me)).toBe(0);
  expect(isDailyLifeComplete(null)).toBe(false);

  expect(isDailyLifeComplete({ ...me, pref_noise: null })).toBe(false);
  expect(unansweredCount({ ...me, pref_noise: null, diet: null })).toBe(2);

  // `false` and "" are answers, not gaps: a non-smoker who prefers not to
  // discuss Shabbat has finished the table.
  expect(isDailyLifeComplete({ ...me, smoker: false, has_pet: false, shabbat: "" })).toBe(true);
});

test("scoring reads an unanswered row as the value the column used to hold", () => {
  const blank = { ...me, smoker: null, cleanliness: null, pref_noise: null, shabbat: null } as Profile;
  const filled = withDailyLifeDefaults(blank);
  // The old NOT NULL defaults, so no existing match score moved when the
  // columns became nullable.
  expect(filled.smoker).toBe(false);
  expect(filled.cleanliness).toBe(3);
  expect(filled.pref_noise).toBe("any");
  expect(filled.shabbat).toBe("");
  // A real answer is never overwritten.
  expect(withDailyLifeDefaults({ ...me, cleanliness: 5 } as Profile).cleanliness).toBe(5);
});

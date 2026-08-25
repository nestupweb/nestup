import { describe, expect, test } from "vitest";
import { dayLabel, groupByDay, previewTime, viewingLabel } from "@/lib/chat-format";

// Local-time construction so the tests are independent of the machine's zone.
const NOW = new Date(2026, 7, 25, 14, 30); // Tue 25 Aug 2026, 14:30 local
const iso = (y: number, m: number, d: number, h = 9, min = 5) => new Date(y, m, d, h, min).toISOString();

describe("dayLabel", () => {
  test("Today / Yesterday / weekday / long date", () => {
    expect(dayLabel(iso(2026, 7, 25), NOW)).toBe("Today");
    expect(dayLabel(iso(2026, 7, 24), NOW)).toBe("Yesterday");
    expect(dayLabel(iso(2026, 7, 21), NOW)).toBe("Friday");
    expect(dayLabel(iso(2026, 6, 1), NOW)).toBe("1 July");
    expect(dayLabel(iso(2025, 11, 31), NOW)).toBe("31 December 2025");
  });
});

describe("previewTime", () => {
  test("time today, Yesterday, short weekday, then dd/mm/yy", () => {
    expect(previewTime(iso(2026, 7, 25, 9, 5), NOW)).toBe("09:05");
    expect(previewTime(iso(2026, 7, 24), NOW)).toBe("Yesterday");
    expect(previewTime(iso(2026, 7, 22), NOW)).toBe("Sat");
    expect(previewTime(iso(2026, 6, 1), NOW)).toBe("01/07/26");
  });
});

describe("groupByDay", () => {
  test("splits a sorted timeline into labelled day groups", () => {
    const items = [
      { id: "a", created_at: iso(2026, 7, 24, 8) },
      { id: "b", created_at: iso(2026, 7, 24, 20) },
      { id: "c", created_at: iso(2026, 7, 25, 1) },
    ];
    const groups = groupByDay(items, NOW);
    expect(groups.map((g) => g.label)).toEqual(["Yesterday", "Today"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["c"]);
  });

  test("empty input gives no groups", () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe("viewingLabel", () => {
  test("formats the date and a time range", () => {
    const { date, time } = viewingLabel(iso(2026, 7, 26, 18, 0), iso(2026, 7, 26, 18, 45));
    expect(date).toBe("Wed, 26 Aug 2026");
    expect(time).toBe("18:00–18:45");
  });
});

test("householdLabel joins first names like a group chat title", async () => {
  const { householdLabel } = await import("@/lib/chat-format");
  expect(householdLabel([])).toBe("NestUp member");
  expect(householdLabel(["Dana Levi"])).toBe("Dana");
  expect(householdLabel(["Dana Levi", "Noa Bar"])).toBe("Dana & Noa");
  expect(householdLabel(["Dana Levi", "Noa Bar", "Omer Katz"])).toBe("Dana, Noa & Omer");
  expect(householdLabel(["Dana", "Noa", "Omer", "Tal"])).toBe("Dana, Noa +2");
});

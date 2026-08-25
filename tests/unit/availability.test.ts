import { describe, expect, test } from "vitest";
import {
  allowedWeekdays,
  describeSlots,
  fitsAvailability,
  localParts,
  normalizeSlots,
  startTimes,
} from "@/lib/availability";

const SLOTS = normalizeSlots([
  { day: 0, from: "17:00", to: "20:00" },
  { day: 1, from: "17:00", to: "20:00" },
  { day: 2, from: "17:00", to: "20:00" },
  { day: 5, from: "10:00", to: "13:00" },
]);

describe("normalizeSlots", () => {
  test("drops malformed or reversed ranges and sorts", () => {
    const out = normalizeSlots([
      { day: 5, from: "10:00", to: "13:00" },
      { day: 0, from: "20:00", to: "17:00" }, // reversed
      { day: 9, from: "10:00", to: "11:00" }, // bad day
      { day: 0, from: "9am", to: "11:00" }, // bad clock
      { day: "1", from: "18:00", to: "19:30" }, // numeric string day is fine
      "garbage",
    ]);
    expect(out).toEqual([
      { day: 1, from: "18:00", to: "19:30" },
      { day: 5, from: "10:00", to: "13:00" },
    ]);
    expect(normalizeSlots("nope")).toEqual([]);
  });
});

describe("startTimes / allowedWeekdays", () => {
  test("offers starts that still end inside the window", () => {
    expect(startTimes(SLOTS, 5, 45)).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00"]);
    expect(startTimes(SLOTS, 5, 60)).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00"]);
    expect(startTimes(SLOTS, 5, 30)).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"]);
    expect(startTimes(SLOTS, 3, 45)).toEqual([]); // Wednesday: no hours
    expect(allowedWeekdays(SLOTS)).toEqual([0, 1, 2, 5]);
  });
  test("falls back to all-day hours when the owner set none", () => {
    const t = startTimes([], 3, 45);
    expect(t[0]).toBe("08:00");
    expect(t[t.length - 1]).toBe("20:30");
    expect(allowedWeekdays([])).toBeNull();
  });
});

describe("fitsAvailability", () => {
  test("checks the request in the listing's time zone (Israel, UTC+3 in summer)", () => {
    // Sunday 6 Sep 2026, 18:00–18:45 Israel time = 15:00Z
    expect(localParts("2026-09-06T15:00:00Z")).toEqual({ day: 0, minutes: 18 * 60 });
    expect(fitsAvailability(SLOTS, "2026-09-06T15:00:00Z", "2026-09-06T15:45:00Z")).toBe(true);
    // ends exactly at closing time → fine
    expect(fitsAvailability(SLOTS, "2026-09-06T16:15:00Z", "2026-09-06T17:00:00Z")).toBe(true);
    // runs past 20:00
    expect(fitsAvailability(SLOTS, "2026-09-06T16:30:00Z", "2026-09-06T17:15:00Z")).toBe(false);
    // Wednesday: no hours
    expect(fitsAvailability(SLOTS, "2026-09-09T15:00:00Z", "2026-09-09T15:45:00Z")).toBe(false);
    // no hours set → anything goes
    expect(fitsAvailability([], "2026-09-09T02:00:00Z", "2026-09-09T02:45:00Z")).toBe(true);
  });
});

describe("describeSlots", () => {
  test("merges consecutive days with the same hours", () => {
    expect(describeSlots(SLOTS)).toEqual(["Sun–Tue 17:00–20:00", "Fri 10:00–13:00"]);
    expect(describeSlots([])).toEqual([]);
  });
});

import { describe, expect, test } from "vitest";
import {
  describeViewing,
  googleCalendarTemplateUrl,
  isValidViewingStart,
  toGoogleDate,
  viewingWindow,
} from "@/lib/calendar";

const NOW = new Date("2026-08-25T10:00:00Z");

describe("toGoogleDate", () => {
  test("uses the compact UTC form Google links expect", () => {
    expect(toGoogleDate(new Date("2026-08-26T15:30:00.000Z"))).toBe("20260826T153000Z");
  });
});

describe("googleCalendarTemplateUrl", () => {
  test("builds a pre-filled create-event link with encoded fields", () => {
    const url = new URL(
      googleCalendarTemplateUrl({
        title: "Viewing: Sunny room",
        details: "Line 1\nLine 2",
        location: "Ahuza 23, Raanana",
        start: new Date("2026-08-26T15:00:00Z"),
        end: new Date("2026-08-26T15:45:00Z"),
        guests: ["a@example.com", "b@example.com"],
      })
    );
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Viewing: Sunny room");
    expect(url.searchParams.get("dates")).toBe("20260826T150000Z/20260826T154500Z");
    expect(url.searchParams.get("details")).toBe("Line 1\nLine 2");
    expect(url.searchParams.get("location")).toBe("Ahuza 23, Raanana");
    expect(url.searchParams.get("add")).toBe("a@example.com,b@example.com");
  });

  test("omits empty optional fields", () => {
    const url = new URL(
      googleCalendarTemplateUrl({ title: "x", start: NOW, end: new Date(NOW.getTime() + 60_000) })
    );
    expect(url.searchParams.has("details")).toBe(false);
    expect(url.searchParams.has("location")).toBe(false);
    expect(url.searchParams.has("add")).toBe(false);
  });
});

describe("isValidViewingStart", () => {
  test("accepts a near-future time and rejects past, garbage, and far-future", () => {
    expect(isValidViewingStart("2026-08-26T15:00:00Z", NOW)).toBe(true);
    expect(isValidViewingStart("2026-08-25T09:00:00Z", NOW)).toBe(false);
    expect(isValidViewingStart("not a date", NOW)).toBe(false);
    expect(isValidViewingStart("2027-08-25T10:00:00Z", NOW)).toBe(false);
  });
});

describe("viewingWindow", () => {
  test("adds the duration to the start", () => {
    const { start, end } = viewingWindow("2026-08-26T15:00:00Z", 45);
    expect(start.toISOString()).toBe("2026-08-26T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-26T15:45:00.000Z");
  });
});

describe("describeViewing", () => {
  test("includes property details, the counterpart, the note, and the chat link", () => {
    const copy = describeViewing(
      { title: "Sunny room", address: "Ahuza 23", city: "Raanana", rent: 3200 },
      "Dana",
      "Ring twice",
      "https://nestup.example/chat/abc"
    );
    expect(copy.summary).toBe("Viewing: Sunny room");
    expect(copy.location).toBe("Ahuza 23, Raanana");
    expect(copy.description).toContain("₪3,200 / month");
    expect(copy.description).toContain("With Dana");
    expect(copy.description).toContain("Note: Ring twice");
    expect(copy.description).toContain("https://nestup.example/chat/abc");
  });

  test("location falls back to the city when there is no street address", () => {
    expect(describeViewing({ title: "t", address: "", city: "Haifa", rent: 1 }, "x", "").location).toBe("Haifa");
  });
});

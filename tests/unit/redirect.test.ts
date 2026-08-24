import { describe, expect, test } from "vitest";
import { sanitizeNextPath } from "@/lib/redirect";

describe("sanitizeNextPath", () => {
  test("passes through a normal path", () => {
    expect(sanitizeNextPath("/profile")).toBe("/profile");
  });
  test("passes through a nested path", () => {
    expect(sanitizeNextPath("/matches/123")).toBe("/matches/123");
  });
  test("rejects a protocol-relative host", () => {
    expect(sanitizeNextPath("//evil.com/phish")).toBe("/swipe");
  });
  test("rejects a backslash host", () => {
    expect(sanitizeNextPath("/\\evil.com")).toBe("/swipe");
  });
  test("rejects an absolute URL", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe("/swipe");
  });
  test("rejects an empty string", () => {
    expect(sanitizeNextPath("")).toBe("/swipe");
  });
  test("uses a custom fallback", () => {
    expect(sanitizeNextPath("//evil.com", "/")).toBe("/");
  });
});

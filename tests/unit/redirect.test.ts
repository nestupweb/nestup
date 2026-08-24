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
  test("rejects a tab-obfuscated protocol-relative host", () => {
    expect(sanitizeNextPath("/\t/evil.com")).toBe("/swipe");
  });
  test("rejects a newline-obfuscated backslash host", () => {
    expect(sanitizeNextPath("/\n\\evil.com")).toBe("/swipe");
  });
  test("rejects a path made absolute after stripping control chars", () => {
    expect(sanitizeNextPath("\thttps://evil.com")).toBe("/swipe");
  });
  test("strips control chars from an otherwise-safe path", () => {
    expect(sanitizeNextPath("/pro\tfile")).toBe("/profile");
  });
});

import { expect, test } from "vitest";
import {
  TAKEN_MESSAGE_MAX,
  checkTakenMessage,
  defaultTakenMessage,
  takenMessageError,
  takenOnLabel,
  tellCountLabel,
} from "@/lib/listing-taken";

test("the offered message names the room and says it is gone", () => {
  const text = defaultTakenMessage("Sunlit room in Florentin");
  expect(text).toContain("Sunlit room in Florentin");
  expect(text).toMatch(/no longer available/i);
  expect(text.length).toBeLessThanOrEqual(TAKEN_MESSAGE_MAX);
});

test("an untitled room still gets a sentence that reads", () => {
  expect(defaultTakenMessage("  ")).toMatch(/^Thanks for your interest — the room has been taken/);
});

test("the message must say something, and must fit in a chat message", () => {
  expect(checkTakenMessage("The room is gone.")).toBeNull();
  expect(checkTakenMessage("   ")).toBe("empty");
  expect(checkTakenMessage("x".repeat(TAKEN_MESSAGE_MAX + 1))).toBe("too_long");
  // Trailing whitespace is not what pushes it over the edge.
  expect(checkTakenMessage("x".repeat(TAKEN_MESSAGE_MAX) + "   ")).toBeNull();
});

test("each problem has a sentence the owner can act on", () => {
  expect(takenMessageError("empty")).toMatch(/write what/i);
  expect(takenMessageError("too_long")).toContain(String(TAKEN_MESSAGE_MAX));
  expect(takenMessageError(null)).toBe("");
});

test("the count line is honest about one person, several, and nobody", () => {
  expect(tellCountLabel(0)).toMatch(/no message will be sent/i);
  expect(tellCountLabel(1)).toMatch(/^1 person/);
  expect(tellCountLabel(6)).toMatch(/^6 people/);
});

test("the taken date is spelled out, and a missing or broken one says nothing", () => {
  expect(takenOnLabel("2026-08-27T10:00:00.000Z")).toBe("Marked taken on 27 August 2026");
  expect(takenOnLabel(null)).toBe("");
  expect(takenOnLabel("not a date")).toBe("");
});

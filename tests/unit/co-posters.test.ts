import { describe, expect, test } from "vitest";
import {
  cleanIds,
  invitePrompt,
  inviteErrorMessage,
  inviteErrorStatus,
  maxTaggedRoommates,
  respondErrorMessage,
  respondErrorStatus,
  tagCapError,
  tagCapHint,
  tagStatusLabel,
} from "@/lib/co-posters";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("the tagging cap", () => {
  // The whole rule: one of the current roommates' rooms is the one being
  // advertised, so it stays untagged and open for whoever answers the ad.
  test("max tagged is one less than the current roommates", () => {
    expect(maxTaggedRoommates(3)).toBe(2);
    expect(maxTaggedRoommates(2)).toBe(1);
    expect(maxTaggedRoommates(10)).toBe(9);
  });

  test("with one roommate or none there is nobody to tag — never a negative cap", () => {
    expect(maxTaggedRoommates(1)).toBe(0);
    expect(maxTaggedRoommates(0)).toBe(0);
    expect(maxTaggedRoommates(-4)).toBe(0);
    expect(maxTaggedRoommates(Number.NaN)).toBe(0);
  });

  test("a half-typed number never widens the cap", () => {
    expect(maxTaggedRoommates(3.9)).toBe(2);
  });

  test("tagging up to the cap is fine; one past it explains why", () => {
    expect(tagCapError(2, 3)).toBeNull();
    expect(tagCapError(0, 0)).toBeNull();
    expect(tagCapError(3, 3)).toMatch(/can tag 2 roommates/i);
    expect(tagCapError(3, 3)).toMatch(/open for the person moving in/i);
  });

  test("at a cap of zero the message says what to change, not just what failed", () => {
    expect(tagCapError(1, 1)).toMatch(/current roommates.*2 or more/i);
  });

  test("the counter reads as progress towards the cap", () => {
    expect(tagCapHint(1, 3)).toBe("1 of 2 tagged");
    expect(tagCapHint(0, 1)).toBe("No room to tag anyone yet");
  });
});

describe("the invitation sentence", () => {
  test("names the author and asks the question", () => {
    expect(invitePrompt("Maya Cohen")).toBe(
      "Maya Cohen added you to a shared listing. Confirm to join as a co-poster?"
    );
  });

  test("a missing name still reads as a sentence", () => {
    expect(invitePrompt("   ")).toBe("A member added you to a shared listing. Confirm to join as a co-poster?");
  });
});

describe("cleanIds", () => {
  test("keeps well-formed ids, de-duplicates, and drops everything else", () => {
    expect(cleanIds([A, B, A, "", null, undefined, "not-a-uuid", 7])).toEqual([A, B]);
  });

  test("is case-insensitive but normalises, so the same person is never asked twice", () => {
    expect(cleanIds([A.toUpperCase(), A])).toEqual([A]);
  });

  test("an empty list stays empty — that is how every tag is cleared", () => {
    expect(cleanIds([])).toEqual([]);
  });
});

describe("database refusals become sentences and status codes", () => {
  test.each([
    ["at most 2 roommate(s) can be tagged when there are 3 current roommates", /more roommates than there are rooms/i, 422],
    ["cannot tag a blocked member", /blocked/i, 403],
    ["only the listing owner may tag roommates", /only the member who posted/i, 403],
    ["tagged member not found", /no longer a member/i, 404],
    ["listing not found", /listing is gone/i, 404],
    // 0033 — one person, one home. The name comes through from the database.
    ["Nir Sharabi already has an active listing", /nir sharabi already has a listing of their own/i, 409],
    ["some unmapped postgres noise", /could not save your roommates/i, 400],
  ])("invite: %s", (dbMessage, sentence, status) => {
    expect(inviteErrorMessage(dbMessage)).toMatch(sentence);
    expect(inviteErrorStatus(dbMessage)).toBe(status);
  });

  test.each([
    ["this invite was already answered", /already answered/i, 409],
    ["only the invited member may answer this", /isn’t yours to answer/i, 403],
    ["invite not found", /no longer there/i, 404],
    ["you already have an active listing", /you already have a listing of your own/i, 409],
    ["something else entirely", /could not save your answer/i, 400],
  ])("respond: %s", (dbMessage, sentence, status) => {
    expect(respondErrorMessage(dbMessage)).toMatch(sentence);
    expect(respondErrorStatus(dbMessage)).toBe(status);
  });
});

describe("tagStatusLabel", () => {
  test("says where each tagged roommate stands", () => {
    expect(tagStatusLabel("accepted")).toBe("Joined");
    expect(tagStatusLabel("declined")).toBe("Declined");
    expect(tagStatusLabel("pending")).toBe("Waiting for their answer");
    // Just picked in the form and not yet saved — nobody has been asked.
    expect(tagStatusLabel(undefined)).toBe("Will be asked when you publish");
  });
});

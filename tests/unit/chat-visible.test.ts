import { describe, expect, test } from "vitest";
import { visibleConversations } from "@/lib/chat";
import type { ConversationSummary } from "@/lib/types";

/** Only the four fields the inbox filter reads actually matter here. */
const row = (id: string, cleared: string | null, lastMessageAt: string | null) =>
  ({
    id,
    cleared_at: cleared,
    last_message_at: lastMessageAt,
    last_message: lastMessageAt ? "hi" : null,
  }) as ConversationSummary;

describe("visibleConversations", () => {
  test("keeps chats that were never deleted, with or without messages", () => {
    const rows = [row("fresh", null, null), row("busy", null, "2026-08-27T10:00:00Z")];
    expect(visibleConversations(rows).map((c) => c.id)).toEqual(["fresh", "busy"]);
  });

  test("drops a deleted chat that has had nothing new said in it", () => {
    // The SQL hides everything up to the cutoff, so last_message_at comes back null.
    expect(visibleConversations([row("gone", "2026-08-27T09:00:00Z", null)])).toEqual([]);
  });

  test("brings a deleted chat back as soon as a newer message lands", () => {
    const rows = [row("back", "2026-08-27T09:00:00Z", "2026-08-27T11:30:00Z")];
    expect(visibleConversations(rows).map((c) => c.id)).toEqual(["back"]);
  });
});

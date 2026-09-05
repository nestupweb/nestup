// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * `sendIntroAction` — the hello a seeker sends straight after a like, and the
 * only place in the app where a conversation is opened from the deck rather
 * than from a room page.
 *
 * `swipe-deck.test.tsx` drives the sheet in the browser with this action
 * mocked out. This is the other half: the action itself, and specifically the
 * three ways it can fail, because all three happen to a real member and each
 * one has to come back as a sentence rather than as a thrown Server Action —
 * a throw here would leave the deck stuck on a card that was already swiped.
 *
 * `saveIntroTemplateAction` is here too: it writes the same feature's one
 * remembered setting, and its only rule is the length of the field.
 */

const insert = vi.fn();
const upsert = vi.fn();
const requireUser = vi.fn();
const findOrCreateConversation = vi.fn();
const markConversationRead = vi.fn();
const from = vi.fn(() => ({ insert, upsert }));

vi.mock("@/lib/auth", () => ({ requireUser }));
vi.mock("@/lib/chat", () => ({ findOrCreateConversation, markConversationRead }));
vi.mock("next/cache", async () => await import("../helpers/next-cache-stub"));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const ME = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";
const CHAT = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null });
  upsert.mockReset().mockResolvedValue({ error: null });
  from.mockClear();
  findOrCreateConversation.mockReset().mockResolvedValue({ id: CHAT });
  markConversationRead.mockReset().mockResolvedValue(undefined);
  requireUser.mockReset().mockResolvedValue({ user: { id: ME }, supabase: { from } });
});

describe("sendIntroAction", () => {
  test("a hello opens the thread, posts the message and returns where to go", async () => {
    const { sendIntroAction } = await import("@/app/actions/swipe");
    const result = await sendIntroAction(ROOM, "  Hi! Is the room still free?  ");

    expect(result).toEqual({ ok: true, conversationId: CHAT });
    expect(findOrCreateConversation).toHaveBeenCalledWith(expect.anything(), ROOM, ME);
    expect(insert).toHaveBeenCalledWith({
      conversation_id: CHAT,
      sender_id: ME,
      // Trimmed by the schema — the sheet's textarea keeps the trailing newline
      // a member leaves behind, and it should not become the message.
      content: "Hi! Is the room still free?",
    });
  });

  /**
   * The seeker wrote it and then read it, so their own copy is read. Without
   * this the member lands in the thread with their unread badge counting the
   * message they just sent.
   */
  test("the sender's own hello does not come back as an unread message", async () => {
    const { sendIntroAction } = await import("@/app/actions/swipe");
    await sendIntroAction(ROOM, "Hello!");
    expect(markConversationRead).toHaveBeenCalledWith(expect.anything(), CHAT);
  });

  test.each([
    ["an empty hello", "   "],
    ["one longer than a chat message allows", "x".repeat(2001)],
  ])("%s never opens a conversation", async (_label, content) => {
    const { sendIntroAction } = await import("@/app/actions/swipe");
    const result = await sendIntroAction(ROOM, content);

    expect(result).toMatchObject({ ok: false });
    expect(findOrCreateConversation).not.toHaveBeenCalled();
    expect(requireUser).not.toHaveBeenCalled();
  });

  test("a room id that isn't one is refused before the room is looked up", async () => {
    const { sendIntroAction } = await import("@/app/actions/swipe");
    const result = await sendIntroAction("not-a-uuid", "Hello!");

    expect(result).toEqual({ ok: false, error: "This room is no longer available." });
    expect(findOrCreateConversation).not.toHaveBeenCalled();
  });

  /**
   * A room pulled or paused between the deck being built and the hello being
   * sent. RLS refuses the conversation, so this comes back as `null` rather
   * than as an error — and it must read as an explanation, not a crash.
   */
  test("a room that can no longer receive messages is explained, not thrown", async () => {
    findOrCreateConversation.mockResolvedValue(null);
    const { sendIntroAction } = await import("@/app/actions/swipe");
    const result = await sendIntroAction(ROOM, "Hello!");

    expect(result).toEqual({ ok: false, error: "This room can't receive messages right now." });
    expect(insert).not.toHaveBeenCalled();
  });

  test("a message that fails to post says so rather than claiming it sent", async () => {
    insert.mockResolvedValue({ error: { message: "row level security" } });
    const { sendIntroAction } = await import("@/app/actions/swipe");
    const result = await sendIntroAction(ROOM, "Hello!");

    expect(result).toMatchObject({ ok: false });
    expect(markConversationRead).not.toHaveBeenCalled();
  });
});

describe("saveIntroTemplateAction", () => {
  test("the remembered hello is trimmed and stored against the member", async () => {
    const { saveIntroTemplateAction } = await import("@/app/actions/swipe");
    await expect(saveIntroTemplateAction("  Hi {name}, is the room free?  ")).resolves.toEqual({ ok: true });

    expect(from).toHaveBeenCalledWith("profile_details");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: ME, intro_template: "Hi {name}, is the room free?" })
    );
  });

  test("a template longer than the field allows is refused before the write", async () => {
    const { saveIntroTemplateAction } = await import("@/app/actions/swipe");
    await expect(saveIntroTemplateAction("x".repeat(501))).resolves.toEqual({ ok: false });
    expect(upsert).not.toHaveBeenCalled();
  });

  /** Clearing the box is a real answer: it puts the built-in hello back. */
  test("an empty template is stored, not rejected", async () => {
    const { saveIntroTemplateAction } = await import("@/app/actions/swipe");
    await expect(saveIntroTemplateAction("")).resolves.toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ intro_template: "" }));
  });
});

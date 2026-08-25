import { beforeEach, expect, test, vi } from "vitest";

/**
 * The send action is idempotent per (conversation, client id): a retry that
 * hits the unique index returns the row the first attempt created instead of
 * failing or duplicating.
 */
type Outcome = { insert: { data: unknown; error: { code: string } | null }; existing?: unknown };
const outcome = vi.hoisted(() => ({ current: null as Outcome | null, inserted: [] as unknown[] }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: "me-111" },
    supabase: {
      from: () => ({
        insert: (row: unknown) => {
          outcome.inserted.push(row);
          return { select: () => ({ single: async () => outcome.current!.insert }) };
        },
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: outcome.current!.existing ?? null }) }) }) }),
      }),
    },
  }),
}));
vi.mock("@/lib/chat", () => ({ markConversationRead: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const CONV = "11111111-1111-4111-8111-111111111111";
const CLIENT = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  outcome.current = null;
  outcome.inserted = [];
});

test("a normal send inserts under the session user with the client id and returns the row", async () => {
  const row = { id: "s1", conversation_id: CONV, sender_id: "me-111", content: "hi", image_path: null, client_id: CLIENT, created_at: "now" };
  outcome.current = { insert: { data: row, error: null } };
  const { sendMessageAction } = await import("@/app/actions/chat");
  const res = await sendMessageAction({ conversationId: CONV, clientId: CLIENT, content: "  hi  " });
  expect(res).toEqual({ ok: true, message: row });
  expect(outcome.inserted[0]).toMatchObject({ sender_id: "me-111", client_id: CLIENT, content: "hi", image_path: null });
});

test("a retry of an already-delivered id returns the existing row instead of a duplicate", async () => {
  const existing = { id: "s1", client_id: CLIENT, content: "hi" };
  outcome.current = { insert: { data: null, error: { code: "23505" } }, existing };
  const { sendMessageAction } = await import("@/app/actions/chat");
  const res = await sendMessageAction({ conversationId: CONV, clientId: CLIENT, content: "hi" });
  expect(res).toEqual({ ok: true, message: existing });
});

test("other database errors surface as a readable failure", async () => {
  outcome.current = { insert: { data: null, error: { code: "42501" } } };
  const { sendMessageAction } = await import("@/app/actions/chat");
  const res = await sendMessageAction({ conversationId: CONV, clientId: CLIENT, content: "hi" });
  expect(res).toEqual({ ok: false, error: "Could not send the message. Please try again." });
});

test("bad ids and empty messages never reach the database", async () => {
  outcome.current = { insert: { data: null, error: null } };
  const { sendMessageAction } = await import("@/app/actions/chat");
  expect((await sendMessageAction({ conversationId: "nope", clientId: CLIENT, content: "hi" })).ok).toBe(false);
  expect((await sendMessageAction({ conversationId: CONV, clientId: "nope", content: "hi" })).ok).toBe(false);
  expect((await sendMessageAction({ conversationId: CONV, clientId: CLIENT, content: "   " })).ok).toBe(false);
  expect(outcome.inserted).toHaveLength(0);
});

// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * `findOrCreateConversation` — the one place a chat thread comes into
 * existence, reached from the swipe deck's hello, from a room page's "Message
 * the household", and from the room's own chat route.
 *
 * There is exactly one thread per (room, seeker), and the database enforces
 * that with a unique constraint. So the interesting case is not the happy path
 * but the race: two tabs, or a double-tapped Send, arriving between the SELECT
 * and the INSERT. One wins, the other's insert is refused — and the loser must
 * end up in the *same* thread rather than seeing "could not send".
 *
 * That fallback was listed in the test specification as an edge case with no
 * test behind it. This is that test.
 */

const maybeSingle = vi.fn();
const single = vi.fn();
const insert = vi.fn(() => ({ select: () => ({ single }) }));
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
  insert,
}));

vi.mock("next/cache", async () => await import("../helpers/next-cache-stub"));
vi.mock("@/lib/auth", () => ({ getAuthContext: vi.fn() }));

const ME = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";
const CHAT = "33333333-3333-4333-8333-333333333333";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = { from } as any;

beforeEach(() => {
  maybeSingle.mockReset();
  single.mockReset();
  insert.mockClear();
  from.mockClear();
});

describe("findOrCreateConversation", () => {
  test("an existing thread is reused — a second hello does not open a second one", async () => {
    maybeSingle.mockResolvedValue({ data: { id: CHAT, listing_id: ROOM, seeker_id: ME } });

    const { findOrCreateConversation } = await import("@/lib/chat");
    const conversation = await findOrCreateConversation(supabase, ROOM, ME);

    expect(conversation?.id).toBe(CHAT);
    expect(insert).not.toHaveBeenCalled();
  });

  test("the first hello creates the thread, for this room and this seeker", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    single.mockResolvedValue({ data: { id: CHAT, listing_id: ROOM, seeker_id: ME }, error: null });

    const { findOrCreateConversation } = await import("@/lib/chat");
    const conversation = await findOrCreateConversation(supabase, ROOM, ME);

    expect(conversation?.id).toBe(CHAT);
    expect(insert).toHaveBeenCalledWith({ listing_id: ROOM, seeker_id: ME });
    expect(from).toHaveBeenCalledWith("conversations");
  });

  /**
   * The race. The second tab's SELECT found nothing, its INSERT lost to the
   * unique constraint, and re-reading finds the row the winner wrote. Both
   * tabs end up in the same thread and the member never sees a failure.
   */
  test("losing the race re-reads the row the winner created, rather than failing", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: CHAT, listing_id: ROOM, seeker_id: ME } });
    single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    const { findOrCreateConversation } = await import("@/lib/chat");
    const conversation = await findOrCreateConversation(supabase, ROOM, ME);

    expect(conversation?.id).toBe(CHAT);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  /**
   * The other reason an insert is refused: RLS. A room that has been pulled or
   * paused genuinely has no thread to open, and the caller turns this `null`
   * into "this room can't receive messages right now" — so it must be a null
   * and not a throw.
   */
  test("a room that refuses the thread comes back as null, never as an exception", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    single.mockResolvedValue({ data: null, error: { code: "42501", message: "row level security" } });

    const { findOrCreateConversation } = await import("@/lib/chat");
    await expect(findOrCreateConversation(supabase, ROOM, ME)).resolves.toBeNull();
  });

  test("an insert that answers with neither a row nor an error is still not a thread", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    single.mockResolvedValue({ data: null, error: null });

    const { findOrCreateConversation } = await import("@/lib/chat");
    await expect(findOrCreateConversation(supabase, ROOM, ME)).resolves.toBeNull();
  });
});

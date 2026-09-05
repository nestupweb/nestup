// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The two writes behind a heart: `recordSwipeAction` (the deck) and
 * `setSavedAction` (the heart on a Listings card or a room page).
 *
 * `cache-invalidation.test.ts` already pins down which caches each of these
 * drops. What is asserted here is the rows they write, and in particular the
 * product rule that a member can see with their own eyes: **a like in the deck
 * and a heart in Listings are the same thing.** A like has to land in
 * `saved_listings` as well as `swipes`, or a room the seeker liked on Swipe
 * shows up hollow in Profile › Liked and the app looks like it forgot.
 *
 * The other rule is the one that makes the deck usable at all: a swipe is
 * recorded once per room per member (`onConflict`), so a room that has been
 * decided on never comes back.
 */

const upsert = vi.fn();
const del = vi.fn();
const eqUser = vi.fn();
const eqListing = vi.fn();
const requireUser = vi.fn();
const tables: string[] = [];

const from = vi.fn((table: string) => {
  tables.push(table);
  return {
    upsert,
    delete: () => {
      del();
      return { eq: (...a: unknown[]) => (eqUser(...a), { eq: (...b: unknown[]) => (eqListing(...b), Promise.resolve({ error: null })) }) };
    },
  };
});

vi.mock("@/lib/auth", () => ({ requireUser }));
vi.mock("next/cache", async () => await import("../helpers/next-cache-stub"));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const ME = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  tables.length = 0;
  upsert.mockReset().mockResolvedValue({ error: null });
  del.mockReset();
  eqUser.mockReset();
  eqListing.mockReset();
  from.mockClear();
  requireUser.mockReset().mockResolvedValue({ user: { id: ME }, supabase: { from } });
});

describe("recordSwipeAction", () => {
  test("a like is written to the deck and mirrored into Liked, so the two hearts agree", async () => {
    const { recordSwipeAction } = await import("@/app/actions/swipe");
    await expect(recordSwipeAction(ROOM, "like")).resolves.toEqual({ ok: true });

    expect(tables).toEqual(["swipes", "saved_listings"]);
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      { seeker_id: ME, listing_id: ROOM, direction: "like" },
      { onConflict: "seeker_id,listing_id" }
    );
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      { user_id: ME, listing_id: ROOM },
      { onConflict: "user_id,listing_id" }
    );
  });

  test("a skip is recorded and never lands in Liked", async () => {
    const { recordSwipeAction } = await import("@/app/actions/swipe");
    await expect(recordSwipeAction(ROOM, "skip")).resolves.toEqual({ ok: true });

    expect(tables).toEqual(["swipes"]);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({ direction: "skip" });
  });

  /**
   * The upsert key is what stops a decided room coming back: swiping the same
   * room twice updates the one row rather than raising a unique violation the
   * deck would have to interpret.
   */
  test("a second decision on the same room updates the one row instead of failing", async () => {
    const { recordSwipeAction } = await import("@/app/actions/swipe");
    await recordSwipeAction(ROOM, "skip");
    await recordSwipeAction(ROOM, "like");

    for (const call of upsert.mock.calls) {
      expect(call[1]).toMatchObject({ onConflict: expect.stringContaining("listing_id") });
    }
  });

  test.each([
    ["a room id that isn't one", "not-a-uuid", "like"],
    ["a direction nobody offered", ROOM, "maybe"],
    ["an empty direction", ROOM, ""],
  ])("%s is refused before the member is even looked up", async (_label, id, direction) => {
    const { recordSwipeAction } = await import("@/app/actions/swipe");
    await expect(
      recordSwipeAction(id, direction as "like" | "skip")
    ).resolves.toEqual({ ok: false });
    expect(requireUser).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  /** A like the deck never stored must not leave a heart behind explaining nothing. */
  test("a swipe that fails to save does not leave a like behind", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "row level security" } });
    const { recordSwipeAction } = await import("@/app/actions/swipe");

    await expect(recordSwipeAction(ROOM, "like")).resolves.toEqual({ ok: false });
    expect(tables).toEqual(["swipes"]);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  test("the listing page's 'I'm interested' records the like and returns to the deck", async () => {
    const { swipeAction } = await import("@/app/actions/swipe");
    await expect(swipeAction(ROOM, "like")).rejects.toThrow("REDIRECT:/swipe");
    expect(tables).toEqual(["swipes", "saved_listings"]);
  });
});

describe("setSavedAction", () => {
  test("liking a room adds one row, keyed so a double tap cannot duplicate it", async () => {
    const { setSavedAction } = await import("@/app/actions/saved");
    await expect(setSavedAction(ROOM, true)).resolves.toEqual({ ok: true });

    expect(tables).toEqual(["saved_listings"]);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: ME, listing_id: ROOM },
      { onConflict: "user_id,listing_id" }
    );
    expect(del).not.toHaveBeenCalled();
  });

  /**
   * The delete is scoped by BOTH columns. Dropping the `user_id` filter would
   * still pass RLS for the caller's own row and quietly attempt everyone
   * else's — the kind of write that is only ever caught by asserting on it.
   */
  test("unliking deletes that member's own row, and only that one", async () => {
    const { setSavedAction } = await import("@/app/actions/saved");
    await expect(setSavedAction(ROOM, false)).resolves.toEqual({ ok: true });

    expect(del).toHaveBeenCalledTimes(1);
    expect(eqUser).toHaveBeenCalledWith("user_id", ME);
    expect(eqListing).toHaveBeenCalledWith("listing_id", ROOM);
    expect(upsert).not.toHaveBeenCalled();
  });

  test("a forged room id is refused before anything is written", async () => {
    const { setSavedAction } = await import("@/app/actions/saved");
    await expect(setSavedAction("../../etc/passwd", true)).resolves.toEqual({ ok: false });
    expect(requireUser).not.toHaveBeenCalled();
  });

  test("a refused write is reported rather than pretending the heart stuck", async () => {
    upsert.mockResolvedValue({ error: { message: "row level security" } });
    const { setSavedAction } = await import("@/app/actions/saved");
    await expect(setSavedAction(ROOM, true)).resolves.toEqual({ ok: false });
  });
});

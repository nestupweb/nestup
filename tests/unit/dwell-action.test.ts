// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DWELL_CAP_MS, DWELL_FLOOR_MS } from "@/lib/affinity";

/**
 * `recordDwellAction` — the write half of personalisation.
 *
 * `affinity.test.ts` covers the maths this feeds (what a reading is worth, and
 * the guarantee that it can only reorder a deck). This covers the row that
 * gets written, which is where the two rules that keep the feature honest
 * live:
 *
 *  1. **The client is not trusted.** The deck posts these numbers from the
 *     browser, so the caps are re-applied on the server rather than assumed.
 *     They match the CHECK constraints in migration 0035, so a forged request
 *     is clamped to the same ceiling an honest one is instead of being
 *     rejected at the database with a 400 the member would see.
 *  2. **The strongest reading wins, not the latest.** A seeker who reloads and
 *     flicks past a room must not erase the long look they gave it earlier.
 *
 * And one non-rule: this is fire-and-forget from under the member's thumb, so
 * every failure path returns quietly. A lost reading costs a little ranking
 * quality; a thrown one would interrupt swiping.
 */

const upsert = vi.fn();
const maybeSingle = vi.fn();
const requireUser = vi.fn();
const from = vi.fn(() => ({
  upsert,
  select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
}));

vi.mock("@/lib/auth", () => ({ requireUser }));
vi.mock("next/cache", async () => await import("../helpers/next-cache-stub"));

const ME = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  upsert.mockReset().mockResolvedValue({ error: null });
  maybeSingle.mockReset().mockResolvedValue({ data: null });
  from.mockClear();
  requireUser.mockReset().mockResolvedValue({ user: { id: ME }, supabase: { from } });
});

/** The row the action tried to write. */
function written(): Record<string, number | string> {
  expect(upsert).toHaveBeenCalledTimes(1);
  return upsert.mock.calls[0][0] as Record<string, number | string>;
}

describe("what never reaches the database", () => {
  test("a room id that isn't one is refused before the member is even looked up", async () => {
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await expect(recordDwellAction("not-a-uuid", 20_000, 4, 3)).resolves.toEqual({ ok: false });
    expect(requireUser).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  /**
   * A mis-tap, or a card passed through on the way to the next one. Storing
   * these would fill the table with rooms the seeker never actually considered
   * and pull their taste towards whatever those rooms happened to be.
   */
  test("a glance below the noise floor is not evidence", async () => {
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await expect(recordDwellAction(ROOM, DWELL_FLOOR_MS - 1, 0, 0)).resolves.toEqual({ ok: false });
    expect(upsert).not.toHaveBeenCalled();
  });

  test("a reading sitting exactly on the floor is kept — the boundary is inclusive", async () => {
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await expect(recordDwellAction(ROOM, DWELL_FLOOR_MS, 0, 0)).resolves.toEqual({ ok: true });
    expect(written().dwell_ms).toBe(DWELL_FLOOR_MS);
  });
});

describe("the client's numbers are re-checked, never trusted", () => {
  test("a forged dwell is clamped to the same ceiling the database would accept", async () => {
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await recordDwellAction(ROOM, 9_999_999, 999, 999);
    const row = written();
    expect(row.dwell_ms).toBe(DWELL_CAP_MS);
    expect(row.photos_seen).toBe(20);
    expect(row.pages_seen).toBe(10);
  });

  test("negative and nonsense counts become zero rather than a negative row", async () => {
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await recordDwellAction(ROOM, 20_000, -5, Number.NaN);
    const row = written();
    expect(row.photos_seen).toBe(0);
    expect(row.pages_seen).toBe(0);
  });

  test("a fractional reading is rounded, so the column always gets an integer", async () => {
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await recordDwellAction(ROOM, 7_500.6, 2.4, 1.6);
    const row = written();
    expect(row.dwell_ms).toBe(7_501);
    expect(row.photos_seen).toBe(2);
    expect(row.pages_seen).toBe(2);
  });

  test("the row is written for the signed-in member, whoever the caller claims to be", async () => {
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await recordDwellAction(ROOM, 20_000, 1, 1);
    expect(written()).toMatchObject({ user_id: ME, listing_id: ROOM });
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "user_id,listing_id" });
    expect(from).toHaveBeenCalledWith("listing_dwell");
  });
});

describe("the strongest reading wins", () => {
  test("a quick second pass cannot erase a long earlier look", async () => {
    maybeSingle.mockResolvedValue({ data: { dwell_ms: 30_000, photos_seen: 6, pages_seen: 3 } });
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await recordDwellAction(ROOM, 2_000, 1, 1);

    expect(written()).toMatchObject({ dwell_ms: 30_000, photos_seen: 6, pages_seen: 3 });
  });

  test("a longer look does replace a shorter one", async () => {
    maybeSingle.mockResolvedValue({ data: { dwell_ms: 2_000, photos_seen: 1, pages_seen: 0 } });
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await recordDwellAction(ROOM, 25_000, 5, 2);

    expect(written()).toMatchObject({ dwell_ms: 25_000, photos_seen: 5, pages_seen: 2 });
  });

  /** Each column is compared on its own: more photos, fewer pages, keeps both bests. */
  test("the comparison is per column, not all-or-nothing", async () => {
    maybeSingle.mockResolvedValue({ data: { dwell_ms: 10_000, photos_seen: 1, pages_seen: 3 } });
    const { recordDwellAction } = await import("@/app/actions/dwell");
    await recordDwellAction(ROOM, 5_000, 7, 0);

    expect(written()).toMatchObject({ dwell_ms: 10_000, photos_seen: 7, pages_seen: 3 });
  });
});

test("a failed write is reported quietly, never thrown at the deck", async () => {
  upsert.mockResolvedValue({ error: { message: "row level security" } });
  const { recordDwellAction } = await import("@/app/actions/dwell");
  await expect(recordDwellAction(ROOM, 20_000, 2, 1)).resolves.toEqual({ ok: false });
});

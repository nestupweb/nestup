// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Closing a room is one database call on purpose: `mark_listing_taken` pauses
 * the listing and writes the notices in a single transaction, under the
 * caller's own RLS. These cover what the action is responsible for — refusing
 * junk before it gets there, and reading the answer correctly.
 */
const rpc = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ rows: [] as unknown[], count: 0, listing: null as unknown }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: "owner-1" },
    supabase: {
      rpc,
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.listing }) }),
            maybeSingle: async () => ({ data: state.listing }),
            then: undefined,
          }),
        }),
        update: (values: unknown) => ({
          eq: () => ({
            eq: async () => {
              update(values);
              return { error: null };
            },
          }),
        }),
      }),
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const LISTING = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  rpc.mockReset();
  update.mockReset();
  state.listing = { id: LISTING };
});

test("closing a room passes the trimmed message and reports how many were told", async () => {
  rpc.mockResolvedValue({ data: 4, error: null });
  const { markListingTakenAction } = await import("@/app/actions/listing-status");

  const form = new FormData();
  form.set("listing_id", LISTING);
  form.set("message", "  The room is gone, thanks!  ");
  const result = await markListingTakenAction({}, form);

  expect(rpc).toHaveBeenCalledWith("mark_listing_taken", {
    p_listing: LISTING,
    p_message: "The room is gone, thanks!",
  });
  expect(result).toEqual({ told: 4 });
});

test("an empty message never reaches the database", async () => {
  const { markListingTakenAction } = await import("@/app/actions/listing-status");
  const form = new FormData();
  form.set("listing_id", LISTING);
  form.set("message", "   ");

  expect(await markListingTakenAction({}, form)).toEqual({ error: "Write what you want everyone to read." });
  expect(rpc).not.toHaveBeenCalled();
});

test("a room that is already closed is reported, not closed twice", async () => {
  // -1 is the function's answer for "not yours, or already taken".
  rpc.mockResolvedValue({ data: -1, error: null });
  const { markListingTakenAction } = await import("@/app/actions/listing-status");
  const form = new FormData();
  form.set("listing_id", LISTING);
  form.set("message", "Gone.");

  expect(await markListingTakenAction({}, form)).toEqual({ error: "This room is already marked as taken." });
});

test("a listing id that isn't one is refused before anything else happens", async () => {
  const { markListingTakenAction } = await import("@/app/actions/listing-status");
  const form = new FormData();
  form.set("listing_id", "../../etc/passwd");
  form.set("message", "Gone.");

  expect((await markListingTakenAction({}, form)).error).toMatch(/could not close/i);
  expect(rpc).not.toHaveBeenCalled();
});

test("re-opening clears the taken stamp and puts the room back on the site", async () => {
  const { reopenListingAction } = await import("@/app/actions/listing-status");
  expect(await reopenListingAction(LISTING)).toEqual({});
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_active: true, taken_at: null }));
});

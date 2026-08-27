// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Deleting your own listing. The row is matched by owner_id as well as id, so a
 * forged listing_id in the form can only ever reach something the signed-in
 * member already owns — the same belt-and-braces rule the update path uses.
 *
 * Since 0028 it does not delete the row: a real delete cascades to the
 * conversations about the room and every message in them, which would destroy
 * the notice on its way out. `remove_listing` takes the room off the site for
 * good and tells everyone in a conversation about it instead.
 */
const rpc = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ title: "Sunlit room in Florentin" as string | null, seen: {} as Record<string, string> }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: "me-111" },
    supabase: {
      rpc,
      from: () => ({
        select: () => ({
          eq: (_c1: string, id: string) => {
            state.seen.id = id;
            return {
              eq: (_c2: string, owner: string) => {
                state.seen.owner = owner;
                return {
                  is: () => ({
                    maybeSingle: async () => ({ data: state.title === null ? null : { title: state.title } }),
                  }),
                };
              },
            };
          },
        }),
      }),
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const LISTING = "22222222-2222-4222-8222-222222222222";

const form = (id: string) => {
  const f = new FormData();
  f.set("listing_id", id);
  return f;
};

beforeEach(() => {
  rpc.mockReset();
  state.title = "Sunlit room in Florentin";
  state.seen = {};
});

test("deleting tells everyone the room is gone, without claiming it was taken", async () => {
  rpc.mockResolvedValue({ data: 3, error: null });
  const { deleteListingAction } = await import("@/app/actions/listing");

  await expect(deleteListingAction({}, form(LISTING))).rejects.toThrow("REDIRECT:/profile?tab=listings");

  expect(rpc).toHaveBeenCalledWith("remove_listing", {
    p_listing: LISTING,
    p_message: expect.stringContaining("Sunlit room in Florentin"),
  });
  expect(rpc.mock.calls[0][1].p_message).toMatch(/no longer available/i);
  // A room can be pulled for any reason — the notice must not invent a deal.
  expect(rpc.mock.calls[0][1].p_message).not.toMatch(/taken/i);
  // The lookup is scoped to the caller, not just to the id in the form.
  expect(state.seen).toEqual({ id: LISTING, owner: "me-111" });
});

test("a room that is already gone says so instead of pretending", async () => {
  state.title = null; // the pre-read finds nothing that is still there
  const { deleteListingAction } = await import("@/app/actions/listing");

  expect(await deleteListingAction({}, form(LISTING))).toEqual({ error: "That listing is already gone." });
  expect(rpc).not.toHaveBeenCalled();
});

test("losing the race to a second tab is reported, not swallowed", async () => {
  // -1 is the function's answer for "not yours, or already removed".
  rpc.mockResolvedValue({ data: -1, error: null });
  const { deleteListingAction } = await import("@/app/actions/listing");

  expect(await deleteListingAction({}, form(LISTING))).toEqual({ error: "That listing is already gone." });
});

test("a room already marked taken is removed without sending the notice twice", async () => {
  // -2: everyone was told when it was closed; the same sentence again is spam.
  rpc.mockResolvedValue({ data: -2, error: null });
  const { deleteListingAction } = await import("@/app/actions/listing");

  await expect(deleteListingAction({}, form(LISTING))).rejects.toThrow("REDIRECT:/profile?tab=listings");
});

test("a form with no listing id never reaches the database", async () => {
  const { deleteListingAction } = await import("@/app/actions/listing");
  expect(await deleteListingAction({}, new FormData())).toEqual({ error: "Could not tell which listing to delete." });
  expect(rpc).not.toHaveBeenCalled();
});

// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Deleting your own listing. The row is matched by owner_id as well as id, so
 * a forged listing_id in the form can only ever delete something the signed-in
 * member already owns — the same belt-and-braces rule the update path uses.
 */
const calls: { table?: string; id?: string; owner?: string } = {};
const del = vi.fn(() => ({ error: null as { message: string } | null }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: "me-111" },
    supabase: {
      from: (table: string) => {
        calls.table = table;
        return {
          delete: () => ({
            eq: (_c1: string, id: string) => {
              calls.id = id;
              return {
                eq: (_c2: string, owner: string) => {
                  calls.owner = owner;
                  return del();
                },
              };
            },
          }),
        };
      },
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

beforeEach(() => {
  del.mockReset().mockReturnValue({ error: null });
  calls.table = calls.id = calls.owner = undefined;
});

function form(id: string): FormData {
  const fd = new FormData();
  fd.set("listing_id", id);
  return fd;
}

test("deletes the listing, scoped to the signed-in owner", async () => {
  const { deleteListingAction } = await import("@/app/actions/listing");
  await expect(deleteListingAction({}, form("listing-9"))).rejects.toThrow("REDIRECT:/profile?tab=listings");
  expect(calls.table).toBe("listings");
  expect(calls.id).toBe("listing-9");
  expect(calls.owner).toBe("me-111");
});

test("a missing id is refused before touching the table", async () => {
  const { deleteListingAction } = await import("@/app/actions/listing");
  const state = await deleteListingAction({}, form(""));
  expect(state.error).toBeTruthy();
  expect(del).not.toHaveBeenCalled();
});

test("a database failure is reported, not swallowed", async () => {
  del.mockReturnValue({ error: { message: "nope" } });
  const { deleteListingAction } = await import("@/app/actions/listing");
  const state = await deleteListingAction({}, form("listing-9"));
  expect(state.error).toMatch(/could not delete/i);
});

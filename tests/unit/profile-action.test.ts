import { beforeEach, expect, test, vi } from "vitest";

/**
 * Only the signed-in user can edit their profile: the row is keyed by the
 * session's user id, never by anything the form submits. (Database RLS
 * enforces the same rule as the last line of defence — see migration 0001.)
 */
const upsert = vi.fn(async (_table: string, _row: unknown) => ({ error: null }));
const auth = vi.hoisted(() => ({ userId: "me-111" }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({
    user: { id: auth.userId },
    supabase: { from: (table: string) => ({ upsert: (row: unknown) => upsert(table, row) }) },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

beforeEach(() => upsert.mockClear());

function validForm(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("full_name", "Noa Peretz");
  fd.set("age", "26");
  fd.set("occupation", "Designer");
  fd.set("bio", "Plants and shakshuka.");
  fd.set("cleanliness", "4");
  fd.set("sleep_schedule", "early");
  fd.set("guests_freq", "sometimes");
  for (const i of ["Cooking", "Yoga", "Art"]) fd.append("interests", i);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

test("saves under the session user's id even if the form names someone else", async () => {
  const { upsertProfileAction } = await import("@/app/actions/profile");
  await expect(
    upsertProfileAction({}, validForm({ user_id: "victim-999", owner_id: "victim-999" }))
  ).rejects.toThrow("REDIRECT:/swipe");

  expect(upsert).toHaveBeenCalledTimes(1);
  const [table, row] = upsert.mock.calls[0] as unknown as [string, Record<string, unknown>];
  expect(table).toBe("profiles");
  expect(row.user_id).toBe("me-111");
  expect(row).not.toHaveProperty("owner_id");
  expect(row.full_name).toBe("Noa Peretz");
});

test("a signed-out request never reaches the database", async () => {
  auth.userId = "";
  vi.doMock("@/lib/auth", () => ({
    requireUser: async () => {
      throw new Error("REDIRECT:/login");
    },
  }));
  vi.resetModules();
  const { upsertProfileAction } = await import("@/app/actions/profile");
  await expect(upsertProfileAction({}, validForm())).rejects.toThrow("REDIRECT:/login");
  expect(upsert).not.toHaveBeenCalled();
});

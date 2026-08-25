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

test("About-me fields in the same form are saved to profile_details under the session user", async () => {
  vi.doMock("@/lib/auth", () => ({
    requireUser: async () => ({
      user: { id: "me-111" },
      supabase: { from: (table: string) => ({ upsert: (row: unknown) => upsert(table, row) }) },
    }),
  }));
  vi.resetModules();
  const { upsertProfileAction } = await import("@/app/actions/profile");
  await expect(
    upsertProfileAction({}, validForm({ about: "Hi!", languages: "Hebrew, English", wake_time: "07:30", instagram: "@noa", next: "/profile" }))
  ).rejects.toThrow("REDIRECT:/profile");

  expect(upsert).toHaveBeenCalledTimes(2);
  const [table, row] = upsert.mock.calls[1] as unknown as [string, Record<string, unknown>];
  expect(table).toBe("profile_details");
  expect(row.user_id).toBe("me-111");
  expect(row.about).toBe("Hi!");
  expect(row.languages).toEqual(["Hebrew", "English"]);
  expect(row.wake_time).toBe("07:30");
  expect(row).not.toHaveProperty("full_name");
});

test("an invalid About-me field blocks the whole save with a readable message", async () => {
  vi.resetModules();
  const { upsertProfileAction } = await import("@/app/actions/profile");
  const res = await upsertProfileAction({}, validForm({ about: "Hi!", wake_time: "7am" }));
  expect(res.error).toMatch(/Wake-up time/);
  expect(upsert).not.toHaveBeenCalled();
});

test("without About-me fields the form saves only the profile (old layout)", async () => {
  vi.resetModules();
  const { upsertProfileAction } = await import("@/app/actions/profile");
  await expect(upsertProfileAction({}, validForm())).rejects.toThrow("REDIRECT:/swipe");
  expect(upsert).toHaveBeenCalledTimes(1);
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

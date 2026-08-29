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

/** Every Daily life answer filled in — what /swipe requires (0035). */
const WHOLE_TABLE: Record<string, string> = {
  smoker: "no", ok_with_smoker: "yes", has_pet: "no", ok_with_pets: "yes",
  cleanliness: "4", pref_cleanliness: "3", sleep_schedule: "early", pref_sleep: "any",
  guests_freq: "sometimes", pref_guests: "any", noise_level: "quiet", pref_noise: "any",
  dietary: "vegetarian", pref_diet: "any", shabbat: "prefer_not_to_say", pref_shabbat: "any",
};

function validForm(extra: Record<string, string> = {}, table = WHOLE_TABLE): FormData {
  const fd = new FormData();
  fd.set("full_name", "Noa Peretz");
  fd.set("age", "26");
  fd.set("occupation", "Designer");
  fd.set("bio", "Plants and shakshuka.");
  for (const [k, v] of Object.entries(table)) fd.set(k, v);
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

/**
 * The table may be left half-answered — saving is never blocked by it. What it
 * costs is the swipe deck, so the save must not land there: /swipe would send
 * them straight back to the form they just submitted.
 */
test("a half-answered table still saves, and lands somewhere that works", async () => {
  vi.resetModules();
  const { upsertProfileAction } = await import("@/app/actions/profile");
  const half = { cleanliness: "4", sleep_schedule: "early", guests_freq: "sometimes" };
  await expect(upsertProfileAction({}, validForm({}, half))).rejects.toThrow("REDIRECT:/profile");

  expect(upsert).toHaveBeenCalledTimes(1);
  const [, row] = upsert.mock.calls[0] as unknown as [string, Record<string, unknown>];
  // Unanswered is null — not the value the column used to default to.
  expect(row.smoker).toBeNull();
  expect(row.ok_with_pets).toBeNull();
  expect(row.pref_noise).toBeNull();
  expect(row.cleanliness).toBe(4);
});

test("Shabbat's 'prefer not to say' is stored as the empty string, not as null", async () => {
  vi.resetModules();
  const { upsertProfileAction } = await import("@/app/actions/profile");
  await expect(upsertProfileAction({}, validForm())).rejects.toThrow("REDIRECT:/swipe");
  const [, row] = upsert.mock.calls[0] as unknown as [string, Record<string, unknown>];
  expect(row.shabbat).toBe("");
  expect(row.smoker).toBe(false);
  expect(row.ok_with_smoker).toBe(true);
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

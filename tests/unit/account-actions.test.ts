// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Changing your own e-mail and password from Settings. The password change is
 * deliberately stricter than Supabase requires: the current password must be
 * re-entered, so an unlocked laptop can't be used to lock the owner out.
 */
const updateUser = vi.fn();
const signInWithPassword = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { updateUser, signInWithPassword, getUser } }),
}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

beforeEach(() => {
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "me-111", email: "me@nestup.dev" } } });
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test("a malformed new e-mail is rejected before Supabase is touched", async () => {
  const { changeEmailAction } = await import("@/app/actions/auth");
  const state = await changeEmailAction({}, form({ email: "not-an-email" }));
  expect(state.error).toMatch(/valid email/i);
  expect(updateUser).not.toHaveBeenCalled();
});

test("re-entering the address you already have is refused", async () => {
  const { changeEmailAction } = await import("@/app/actions/auth");
  const state = await changeEmailAction({}, form({ email: "ME@nestup.dev" }));
  expect(state.error).toMatch(/already your/i);
  expect(updateUser).not.toHaveBeenCalled();
});

test("a new address is submitted and the member is told to confirm it", async () => {
  const { changeEmailAction } = await import("@/app/actions/auth");
  const state = await changeEmailAction({}, form({ email: "new@nestup.dev" }));
  expect(updateUser).toHaveBeenCalledWith({ email: "new@nestup.dev" });
  expect(state.sent).toBe(true);
});

test("a short password is rejected", async () => {
  const { changePasswordAction } = await import("@/app/actions/auth");
  const state = await changePasswordAction({}, form({ current: "old-one-123", password: "short", confirm: "short" }));
  expect(state.error).toMatch(/at least 8/i);
  expect(updateUser).not.toHaveBeenCalled();
});

test("mismatched new passwords are rejected", async () => {
  const { changePasswordAction } = await import("@/app/actions/auth");
  const state = await changePasswordAction({}, form({ current: "old-one-123", password: "brand-new-1", confirm: "brand-new-2" }));
  expect(state.error).toMatch(/don't match/i);
  expect(updateUser).not.toHaveBeenCalled();
});

test("the wrong current password never reaches updateUser", async () => {
  signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
  const { changePasswordAction } = await import("@/app/actions/auth");
  const state = await changePasswordAction({}, form({ current: "wrong-one-99", password: "brand-new-1", confirm: "brand-new-1" }));
  expect(state.error).toMatch(/current password/i);
  expect(updateUser).not.toHaveBeenCalled();
});

test("the right current password changes it", async () => {
  const { changePasswordAction } = await import("@/app/actions/auth");
  const state = await changePasswordAction({}, form({ current: "old-one-123", password: "brand-new-1", confirm: "brand-new-1" }));
  expect(signInWithPassword).toHaveBeenCalledWith({ email: "me@nestup.dev", password: "old-one-123" });
  expect(updateUser).toHaveBeenCalledWith({ password: "brand-new-1" });
  expect(state.done).toBe(true);
});

test("re-using the same password is explained, not shrugged off", async () => {
  updateUser.mockResolvedValue({ data: {}, error: { code: "same_password", message: "same" } });
  const { changePasswordAction } = await import("@/app/actions/auth");
  const state = await changePasswordAction({}, form({ current: "old-one-123", password: "old-one-123", confirm: "old-one-123" }));
  expect(state.error).toMatch(/haven't used before/i);
});

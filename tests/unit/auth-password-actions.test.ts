// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Forgot/reset password server actions. The request form must not reveal
 * whether an email has an account, and the reset form must only ever change
 * the password of the session the recovery link created.
 */
const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail, updateUser, getUser } }),
}));
const reqHeaders = new Map<string, string>();
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => reqHeaders.get(k) ?? null }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  reqHeaders.clear();
  reqHeaders.set("host", "nestup-kappa.vercel.app");
  reqHeaders.set("x-forwarded-proto", "https");
  resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "me-111" } } });
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test("requesting a reset emails a link back to this site's /auth/confirm → /reset-password", async () => {
  const { requestPasswordResetAction } = await import("@/app/actions/auth");
  expect(await requestPasswordResetAction({}, form({ email: "  Noa@Example.com " }))).toEqual({ sent: true });
  expect(resetPasswordForEmail).toHaveBeenCalledWith("noa@example.com", {
    redirectTo: "https://nestup-kappa.vercel.app/auth/confirm?next=/reset-password",
  });
});

test("NEXT_PUBLIC_SITE_URL wins over the request host for the link", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://nestup.example/";
  const { requestPasswordResetAction } = await import("@/app/actions/auth");
  await requestPasswordResetAction({}, form({ email: "noa@example.com" }));
  expect(resetPasswordForEmail.mock.calls[0][1].redirectTo).toBe("https://nestup.example/auth/confirm?next=/reset-password");
});

test("does not reveal whether the address has an account", async () => {
  resetPasswordForEmail.mockResolvedValue({ data: null, error: { status: 400, message: "User not found" } });
  const { requestPasswordResetAction } = await import("@/app/actions/auth");
  expect(await requestPasswordResetAction({}, form({ email: "nobody@example.com" }))).toEqual({ sent: true });
});

test("rejects a malformed email and surfaces throttling", async () => {
  const { requestPasswordResetAction } = await import("@/app/actions/auth");
  expect(await requestPasswordResetAction({}, form({ email: "not-an-email" }))).toEqual({
    error: "Please enter a valid email address.",
  });
  expect(resetPasswordForEmail).not.toHaveBeenCalled();
  resetPasswordForEmail.mockResolvedValue({ data: null, error: { status: 429, message: "rate limit" } });
  const r = await requestPasswordResetAction({}, form({ email: "noa@example.com" }));
  expect(r.error).toMatch(/too many requests/i);
});

test("setting the new password validates, requires the recovery session, then goes to /swipe", async () => {
  const { updatePasswordAction } = await import("@/app/actions/auth");
  expect(await updatePasswordAction({}, form({ password: "short", confirm: "short" }))).toEqual({
    error: "Password must be at least 8 characters.",
  });
  expect(await updatePasswordAction({}, form({ password: "longenough1", confirm: "longenough2" }))).toEqual({
    error: "The two passwords don't match.",
  });
  expect(updateUser).not.toHaveBeenCalled();

  getUser.mockResolvedValue({ data: { user: null } });
  await expect(updatePasswordAction({}, form({ password: "longenough1", confirm: "longenough1" }))).rejects.toThrow(
    "REDIRECT:/login?error=recovery"
  );
  expect(updateUser).not.toHaveBeenCalled();

  getUser.mockResolvedValue({ data: { user: { id: "me-111" } } });
  await expect(updatePasswordAction({}, form({ password: "longenough1", confirm: "longenough1" }))).rejects.toThrow(
    "REDIRECT:/swipe"
  );
  expect(updateUser).toHaveBeenCalledWith({ password: "longenough1" });
});

test("explains when Supabase rejects the same password", async () => {
  updateUser.mockResolvedValue({ data: null, error: { code: "same_password", message: "same" } });
  const { updatePasswordAction } = await import("@/app/actions/auth");
  expect(await updatePasswordAction({}, form({ password: "longenough1", confirm: "longenough1" }))).toEqual({
    error: "Choose a password you haven't used before.",
  });
});

// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Forgot/reset password server actions. The request form must not reveal
 * whether an email has an account, and the reset form must only ever change
 * the password of the session the recovery link created.
 */
const sendRecoveryMail = vi.fn();
const updateUser = vi.fn();
const getUser = vi.fn();
// The recovery mail is sent by the app now, not by Supabase Auth (2026-08-29 —
// GoTrue's mailer has no plain-text part and was measured landing in spam), so
// the site the link points at is asserted through `sendRecoveryMail` instead
// of through `resetPasswordForEmail`'s `redirectTo`.
vi.mock("@/lib/auth-mail", () => ({ sendRecoveryMail, sendConfirmationMail: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { updateUser, getUser } }),
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
  sendRecoveryMail.mockReset().mockResolvedValue({ status: "sent" });
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "me-111" } } });
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test("requesting a reset mails a link built from this site's own origin", async () => {
  const { requestPasswordResetAction } = await import("@/app/actions/auth");
  expect(await requestPasswordResetAction({}, form({ email: "  Noa@Example.com " }))).toEqual({ sent: true });
  expect(sendRecoveryMail).toHaveBeenCalledWith("noa@example.com", "https://nestup-kappa.vercel.app");
});

test("NEXT_PUBLIC_SITE_URL wins over the request host for the link", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://nestup.example/";
  const { requestPasswordResetAction } = await import("@/app/actions/auth");
  await requestPasswordResetAction({}, form({ email: "noa@example.com" }));
  expect(sendRecoveryMail.mock.calls[0][1]).toBe("https://nestup.example");
});

test("does not reveal whether the address has an account", async () => {
  // An address with no account is reported as sent, with nothing sent.
  sendRecoveryMail.mockResolvedValue({ status: "sent" });
  const { requestPasswordResetAction } = await import("@/app/actions/auth");
  expect(await requestPasswordResetAction({}, form({ email: "nobody@example.com" }))).toEqual({ sent: true });
});

test("rejects a malformed email and surfaces throttling", async () => {
  const { requestPasswordResetAction } = await import("@/app/actions/auth");
  expect(await requestPasswordResetAction({}, form({ email: "not-an-email" }))).toEqual({
    error: "Please enter a valid email address.",
  });
  expect(sendRecoveryMail).not.toHaveBeenCalled();
  sendRecoveryMail.mockResolvedValue({ status: "throttled", seconds: 42 });
  const r = await requestPasswordResetAction({}, form({ email: "noa@example.com" }));
  expect(r.error).toMatch(/42 seconds/);
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

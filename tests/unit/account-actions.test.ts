// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Changing your own e-mail and password from Settings. The password change is
 * deliberately stricter than Supabase requires: the current password must be
 * re-entered, so an unlocked laptop can't be used to lock the owner out.
 *
 * E-mail changes go through `lib/auth-mail.ts`'s `sendEmailChangeMail`
 * (2026-08-30) rather than `supabase.auth.updateUser({ email })`: a 6-digit
 * code goes ONLY to the new address (`mailer_secure_email_change_enabled:
 * false` in `scripts/auth-config.mjs`), and `verifyOtp({ type: "email_change"
 * })` is what actually completes the switch — mirroring how sign-up moved off
 * Supabase's own mailer onto a code the app sends and verifies itself.
 */
const updateUser = vi.fn();
const signInWithPassword = vi.fn();
const getUser = vi.fn();
const verifyOtp = vi.fn();
const sendEmailChangeMail = vi.fn();
/** `requireUser` checks `suspensions` on every call (migration 0029). */
const suspensionRow = vi.fn();
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: suspensionRow }) }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { updateUser, signInWithPassword, getUser, verifyOtp }, from }),
}));
vi.mock("@/lib/auth-mail", () => ({ sendEmailChangeMail }));
vi.mock("next/cache", async () => await import("../helpers/next-cache-stub"));
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
  verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  sendEmailChangeMail.mockReset().mockResolvedValue({ status: "sent" });
  suspensionRow.mockReset().mockResolvedValue({ data: null });
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
  expect(sendEmailChangeMail).not.toHaveBeenCalled();
});

test("re-entering the address you already have is refused", async () => {
  const { changeEmailAction } = await import("@/app/actions/auth");
  const state = await changeEmailAction({}, form({ email: "ME@nestup.dev" }));
  expect(state.error).toMatch(/already your/i);
  expect(sendEmailChangeMail).not.toHaveBeenCalled();
});

test("a new address gets a code sent to it, not the old address", async () => {
  const { changeEmailAction } = await import("@/app/actions/auth");
  const state = await changeEmailAction({}, form({ email: "new@nestup.dev" }));
  expect(sendEmailChangeMail).toHaveBeenCalledWith("me@nestup.dev", "new@nestup.dev", expect.any(String));
  expect(state.sent).toBe(true);
  expect(state.email).toBe("new@nestup.dev");
});

test("an address already confirmed on another account is called out", async () => {
  sendEmailChangeMail.mockResolvedValue({ status: "taken" });
  const { changeEmailAction } = await import("@/app/actions/auth");
  const state = await changeEmailAction({}, form({ email: "taken@nestup.dev" }));
  expect(state.error).toMatch(/already in use/i);
  expect(state.sent).toBeUndefined();
});

test("asking again inside the one-per-minute window is a wait, not a failure", async () => {
  sendEmailChangeMail.mockResolvedValue({ status: "throttled", seconds: 47 });
  const { changeEmailAction } = await import("@/app/actions/auth");
  const state = await changeEmailAction({}, form({ email: "new@nestup.dev" }));
  expect(state.error).toMatch(/47 seconds/);
  expect(state.sent).toBeUndefined();
});

test("resending the code is tracked separately so a throttled resend can't blank the code screen", async () => {
  sendEmailChangeMail.mockResolvedValue({ status: "throttled", seconds: 30 });
  const { resendEmailChangeCodeAction } = await import("@/app/actions/auth");
  const state = await resendEmailChangeCodeAction({}, form({ email: "new@nestup.dev" }));
  expect(state.error).toMatch(/30 seconds/);
  expect(state.sent).toBeUndefined();
});

test("resending a code re-sends to the same new address", async () => {
  const { resendEmailChangeCodeAction } = await import("@/app/actions/auth");
  const state = await resendEmailChangeCodeAction({}, form({ email: "New@Nestup.dev" }));
  expect(sendEmailChangeMail).toHaveBeenCalledWith("me@nestup.dev", "new@nestup.dev", expect.any(String));
  expect(state.sent).toBe(true);
  expect(state.email).toBe("new@nestup.dev");
});

/**
 * Confirming with the 6-digit code from the new address's inbox. `verifyOtp`
 * is asked for the NEW address, per GoTrue's own lookup for a single-code
 * (secure-email-change-disabled) flow.
 */
test("a correct code completes the switch", async () => {
  const { verifyEmailChangeCodeAction } = await import("@/app/actions/auth");
  const state = await verifyEmailChangeCodeAction({}, form({ email: "New@Nestup.dev", code: "123456" }));
  expect(verifyOtp).toHaveBeenCalledWith({ email: "new@nestup.dev", token: "123456", type: "email_change" });
  expect(state.done).toBe(true);
});

test("a short code never reaches Supabase", async () => {
  const { verifyEmailChangeCodeAction } = await import("@/app/actions/auth");
  const state = await verifyEmailChangeCodeAction({}, form({ email: "new@nestup.dev", code: "123" }));
  expect(state.error).toMatch(/6-digit/i);
  expect(verifyOtp).not.toHaveBeenCalled();
});

test("a wrong or expired code says both, since Supabase does not distinguish them", async () => {
  verifyOtp.mockResolvedValue({ data: {}, error: { status: 403, message: "Token has expired or is invalid" } });
  const { verifyEmailChangeCodeAction } = await import("@/app/actions/auth");
  const state = await verifyEmailChangeCodeAction({}, form({ email: "new@nestup.dev", code: "999999" }));
  expect(state.error).toMatch(/wrong or has expired/i);
  expect(state.email).toBe("new@nestup.dev");
});

test("too many attempts are reported as a wait, not a bad code", async () => {
  verifyOtp.mockResolvedValue({
    data: {},
    error: { status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 31 seconds." },
  });
  const { verifyEmailChangeCodeAction } = await import("@/app/actions/auth");
  const state = await verifyEmailChangeCodeAction({}, form({ email: "new@nestup.dev", code: "123456" }));
  expect(state.error).toMatch(/31 seconds/);
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

test("a suspended member is bounced out of the account actions, not served them", async () => {
  suspensionRow.mockResolvedValue({ data: { user_id: "me-111" } });
  const { changeEmailAction } = await import("@/app/actions/auth");
  await expect(changeEmailAction({}, form({ email: "new@nestup.dev" }))).rejects.toThrow(
    "REDIRECT:/login?error=suspended"
  );
  expect(sendEmailChangeMail).not.toHaveBeenCalled();
});

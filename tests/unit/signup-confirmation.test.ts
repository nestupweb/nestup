// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Signing up must never hand back a usable account: Supabase creates the row,
 * mails a confirmation link, and withholds the session until it is clicked.
 * These cover the two ways a member can end up stranded — a mail that never
 * arrives, and a mistyped address.
 */
const signUp = vi.fn();
const resend = vi.fn();
const getUser = vi.fn();
const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signUp, resend, getUser, verifyOtp } }) }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

beforeEach(() => {
  // A brand-new address comes back with its "email" identity (measured against
  // the live project) — an empty array is how Supabase says "already taken".
  signUp
    .mockReset()
    .mockResolvedValue({ data: { user: { id: "u1", identities: [{ provider: "email" }] }, session: null }, error: null });
  resend.mockReset().mockResolvedValue({ data: {}, error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: null } });
  verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test("signing up never returns a session — only a 'we mailed you' state", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "New@Nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(signUp).toHaveBeenCalledWith({ email: "new@nestup.dev", password: "goodpassword" });
  expect(state.sent).toBe(true);
  expect(state.error).toBeUndefined();
});

test("the address is handed back so the screen can show where the mail went", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "New@Nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.email).toBe("new@nestup.dev");
});

test("a too-short password never reaches Supabase", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "short", confirm: "short" }));
  expect(state.error).toMatch(/at least 8/i);
  expect(signUp).not.toHaveBeenCalled();
});

test("resending asks Supabase for another signup link for the same address", async () => {
  const { resendConfirmationAction } = await import("@/app/actions/auth");
  const state = await resendConfirmationAction({}, form({ email: "New@Nestup.dev" }));
  expect(resend).toHaveBeenCalledWith({ type: "signup", email: "new@nestup.dev" });
  expect(state.sent).toBe(true);
  expect(state.email).toBe("new@nestup.dev");
});

test("resending too soon says to wait rather than failing silently", async () => {
  resend.mockResolvedValue({ data: {}, error: { status: 429, message: "rate limited" } });
  const { resendConfirmationAction } = await import("@/app/actions/auth");
  const state = await resendConfirmationAction({}, form({ email: "new@nestup.dev" }));
  expect(state.error).toMatch(/minute/i);
  expect(state.sent).toBeUndefined();
});

/**
 * Supabase allows one auth mail per address per minute. A member who doesn't
 * see the mail and presses Sign up again lands inside that window, and the
 * 429 that comes back used to be reported as "Could not create the account.
 * Try a different email." — which is both untrue and the worst possible
 * advice: the account exists and a link is already on its way.
 */
test("a signup inside the 60s window shows the inbox screen, not 'try a different email'", async () => {
  signUp.mockResolvedValue({
    data: { user: null, session: null },
    error: { status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 47 seconds." },
  });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.sent).toBe(true);
  expect(state.email).toBe("new@nestup.dev");
  expect(state.throttled).toBe(true);
  expect(state.error).toBeUndefined();
});

/**
 * Supabase's e-mail enumeration protection answers a sign-up for an address
 * that already has a confirmed account with 200 and a decoy user — same shape
 * as success, but with no identities. Read as success it strands the member on
 * "Check your inbox" waiting for a mail that will never be sent.
 */
test("an address that already has an account is called out, not sent to the inbox screen", async () => {
  signUp.mockResolvedValue({
    data: { user: { id: "decoy-uuid", identities: [] }, session: null },
    error: null,
  });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "Taken@Nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.error).toMatch(/already in use/i);
  expect(state.taken).toBe(true);
  expect(state.sent).toBeUndefined();
  expect(state.email).toBe("taken@nestup.dev");
});

/**
 * The other side of it: an address that exists but was never confirmed comes
 * back with its real identity and a fresh link already on its way, so it must
 * still reach the inbox screen — telling that member "already in use" would
 * strand them with an account they can't confirm.
 */
test("an existing but unconfirmed address still gets the inbox screen", async () => {
  signUp.mockResolvedValue({
    data: { user: { id: "u9", identities: [{ provider: "email", identity_data: { email_verified: false } }] }, session: null },
    error: null,
  });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "unconfirmed@nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.sent).toBe(true);
  expect(state.taken).toBeUndefined();
  expect(state.error).toBeUndefined();
});

/** An API that stops sending `identities` must cost the warning, never invent one. */
test("a response with no identities field at all is not read as 'taken'", async () => {
  signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.sent).toBe(true);
  expect(state.taken).toBeUndefined();
});

test("a signup that fails for any other reason still reports an error", async () => {
  signUp.mockResolvedValue({ data: { user: null, session: null }, error: { status: 400, message: "nope" } });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.error).toMatch(/could not create/i);
  expect(state.sent).toBeUndefined();
});

test("resending too soon says how many seconds are left when Supabase names one", async () => {
  resend.mockResolvedValue({
    data: {},
    error: { status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 47 seconds." },
  });
  const { resendConfirmationAction } = await import("@/app/actions/auth");
  const state = await resendConfirmationAction({}, form({ email: "new@nestup.dev" }));
  expect(state.error).toMatch(/47 seconds/);
  expect(state.sent).toBeUndefined();
});

test("resending to a malformed address is refused before Supabase is called", async () => {
  const { resendConfirmationAction } = await import("@/app/actions/auth");
  const state = await resendConfirmationAction({}, form({ email: "nope" }));
  expect(state.error).toMatch(/valid email/i);
  expect(resend).not.toHaveBeenCalled();
});

/**
 * Confirming with the six-digit code from the e-mail. `verifyOtp` both marks
 * the address confirmed and hands back a session, so a correct code goes
 * straight to onboarding rather than back to the login form.
 */
test("a correct code confirms the address and lands in onboarding", async () => {
  const { verifyCodeAction } = await import("@/app/actions/auth");
  await expect(
    verifyCodeAction({}, form({ email: "New@Nestup.dev", code: "123456" }))
  ).rejects.toThrow("REDIRECT:/profile?onboarding=1");
  expect(verifyOtp).toHaveBeenCalledWith({ email: "new@nestup.dev", token: "123456", type: "email" });
});

test("spaces and dashes in a pasted code are ignored", async () => {
  const { verifyCodeAction } = await import("@/app/actions/auth");
  await expect(
    verifyCodeAction({}, form({ email: "new@nestup.dev", code: "12 34-56" }))
  ).rejects.toThrow(/REDIRECT:/);
  expect(verifyOtp).toHaveBeenCalledWith({ email: "new@nestup.dev", token: "123456", type: "email" });
});

test("a short code never reaches Supabase", async () => {
  const { verifyCodeAction } = await import("@/app/actions/auth");
  const state = await verifyCodeAction({}, form({ email: "new@nestup.dev", code: "123" }));
  expect(state.error).toMatch(/6-digit/i);
  expect(verifyOtp).not.toHaveBeenCalled();
});

test("a wrong or expired code says both, since Supabase does not distinguish them", async () => {
  verifyOtp.mockResolvedValue({ data: {}, error: { status: 403, message: "Token has expired or is invalid" } });
  const { verifyCodeAction } = await import("@/app/actions/auth");
  const state = await verifyCodeAction({}, form({ email: "new@nestup.dev", code: "999999" }));
  expect(state.error).toMatch(/wrong or has expired/i);
  expect(state.email).toBe("new@nestup.dev");
});

test("too many attempts are reported as a wait, not a bad code", async () => {
  verifyOtp.mockResolvedValue({
    data: {},
    error: { status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 31 seconds." },
  });
  const { verifyCodeAction } = await import("@/app/actions/auth");
  const state = await verifyCodeAction({}, form({ email: "new@nestup.dev", code: "123456" }));
  expect(state.error).toMatch(/31 seconds/);
});

/**
 * Two password boxes on sign-up. The form disables submit on a mismatch, but
 * the action is the guarantee — a typo here costs an e-mail round-trip to undo.
 */
test("a mismatched confirmation never reaches Supabase", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword", confirm: "goodpasswerd" }));
  expect(state.error).toMatch(/don't match/i);
  expect(signUp).not.toHaveBeenCalled();
});

test("a missing confirmation is a mismatch, not a pass", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword" }));
  expect(state.error).toMatch(/don't match/i);
  expect(signUp).not.toHaveBeenCalled();
});

test("the length rule is checked before the match, so the clearer error wins", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "short", confirm: "different" }));
  expect(state.error).toMatch(/at least 8/i);
});

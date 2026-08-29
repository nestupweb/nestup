// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Signing up must never hand back a usable account: the row is created, a
 * confirmation code is mailed, and the session is withheld until the code is
 * entered. These cover the two ways a member can end up stranded — a mail that
 * never arrives, and a mistyped address.
 *
 * The mail itself is sent by `lib/auth-mail.ts` rather than by Supabase Auth
 * (2026-08-29 — Supabase's mailer has no plain-text part and was measured
 * landing this message in spam), so that is what these mock. The states the
 * action can return are unchanged; only what produces them moved.
 */
const sendConfirmationMail = vi.fn();
const getUser = vi.fn();
const verifyOtp = vi.fn();
vi.mock("@/lib/auth-mail", () => ({ sendConfirmationMail, sendRecoveryMail: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser, verifyOtp } }) }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

beforeEach(() => {
  sendConfirmationMail.mockReset().mockResolvedValue({ status: "sent" });
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
  expect(sendConfirmationMail).toHaveBeenCalledWith("new@nestup.dev", expect.any(String), "goodpassword");
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
  expect(sendConfirmationMail).not.toHaveBeenCalled();
});

test("resending asks for another code without a password, which it cannot know", async () => {
  const { resendConfirmationAction } = await import("@/app/actions/auth");
  const state = await resendConfirmationAction({}, form({ email: "New@Nestup.dev" }));
  expect(sendConfirmationMail).toHaveBeenCalledWith("new@nestup.dev", expect.any(String));
  expect(state.sent).toBe(true);
  expect(state.email).toBe("new@nestup.dev");
});

test("resending too soon says to wait rather than failing silently", async () => {
  sendConfirmationMail.mockResolvedValue({ status: "throttled", seconds: 60 });
  const { resendConfirmationAction } = await import("@/app/actions/auth");
  const state = await resendConfirmationAction({}, form({ email: "new@nestup.dev" }));
  expect(state.error).toMatch(/60 seconds/);
  expect(state.sent).toBeUndefined();
});

/**
 * One auth mail per address per minute (`THROTTLE_SECONDS`, enforced by
 * `lib/auth-mail.ts` now that GoTrue is no longer the sender). A member who
 * doesn't see the mail and presses Sign up again lands inside that window, and
 * that used to be reported as "Could not create the account. Try a different
 * email." — both untrue and the worst possible advice, since the account
 * exists and a code is already on its way.
 */
test("a signup inside the 60s window shows the inbox screen, not 'try a different email'", async () => {
  sendConfirmationMail.mockResolvedValue({ status: "throttled", seconds: 47 });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.sent).toBe(true);
  expect(state.email).toBe("new@nestup.dev");
  expect(state.throttled).toBe(true);
  expect(state.error).toBeUndefined();
});

/**
 * An address with a confirmed account must be named as taken. Read as success
 * it strands the member on "Check your inbox" waiting for a mail that will
 * never be sent — the bug this project shipped and then fixed on 2026-08-27.
 * `generateLink` states it outright (422 email_exists) where `signUp` used to
 * hide it behind a decoy user with an empty `identities` array.
 */
test("an address that already has an account is called out, not sent to the inbox screen", async () => {
  sendConfirmationMail.mockResolvedValue({ status: "taken" });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "Taken@Nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.error).toMatch(/already in use/i);
  expect(state.taken).toBe(true);
  expect(state.sent).toBeUndefined();
  expect(state.email).toBe("taken@nestup.dev");
});

/**
 * The other side of it: an address that exists but was never confirmed gets a
 * freshly re-issued code, so it must still reach the inbox screen — telling
 * that member "already in use" would strand them with an account they can
 * never confirm.
 */
test("an existing but unconfirmed address still gets the inbox screen", async () => {
  sendConfirmationMail.mockResolvedValue({ status: "sent" });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "unconfirmed@nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.sent).toBe(true);
  expect(state.taken).toBeUndefined();
  expect(state.error).toBeUndefined();
});

/**
 * "Already in use" strands a member who has every right to sign up, so only an
 * explicit `taken` may produce it. An unrecognised status must fall through to
 * the generic error, never to the accusation.
 */
test("only an explicit 'taken' is read as 'already in use'", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  for (const status of ["sent", "error", "something-new"]) {
    sendConfirmationMail.mockResolvedValue({ status });
    const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
    expect(state.taken).toBeUndefined();
    expect(state.error ?? "").not.toMatch(/already in use/i);
  }
});

test("a signup that fails for any other reason still reports an error", async () => {
  sendConfirmationMail.mockResolvedValue({ status: "error" });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword", confirm: "goodpassword" }));
  expect(state.error).toMatch(/could not create/i);
  expect(state.sent).toBeUndefined();
});

test("resending too soon says how many seconds are left when Supabase names one", async () => {
  sendConfirmationMail.mockResolvedValue({ status: "throttled", seconds: 47 });
  const { resendConfirmationAction } = await import("@/app/actions/auth");
  const state = await resendConfirmationAction({}, form({ email: "new@nestup.dev" }));
  expect(state.error).toMatch(/47 seconds/);
  expect(state.sent).toBeUndefined();
});

test("resending to a malformed address is refused before Supabase is called", async () => {
  const { resendConfirmationAction } = await import("@/app/actions/auth");
  const state = await resendConfirmationAction({}, form({ email: "nope" }));
  expect(state.error).toMatch(/valid email/i);
  expect(sendConfirmationMail).not.toHaveBeenCalled();
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
  expect(sendConfirmationMail).not.toHaveBeenCalled();
});

test("a missing confirmation is a mismatch, not a pass", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword" }));
  expect(state.error).toMatch(/don't match/i);
  expect(sendConfirmationMail).not.toHaveBeenCalled();
});

test("the length rule is checked before the match, so the clearer error wins", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "short", confirm: "different" }));
  expect(state.error).toMatch(/at least 8/i);
});

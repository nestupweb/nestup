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
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signUp, resend, getUser } }) }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

beforeEach(() => {
  signUp.mockReset().mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
  resend.mockReset().mockResolvedValue({ data: {}, error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: null } });
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test("signing up never returns a session — only a 'we mailed you' state", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "New@Nestup.dev", password: "goodpassword" }));
  expect(signUp).toHaveBeenCalledWith({ email: "new@nestup.dev", password: "goodpassword" });
  expect(state.sent).toBe(true);
  expect(state.error).toBeUndefined();
});

test("the address is handed back so the screen can show where the mail went", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "New@Nestup.dev", password: "goodpassword" }));
  expect(state.email).toBe("new@nestup.dev");
});

test("a too-short password never reaches Supabase", async () => {
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "short" }));
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
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword" }));
  expect(state.sent).toBe(true);
  expect(state.email).toBe("new@nestup.dev");
  expect(state.throttled).toBe(true);
  expect(state.error).toBeUndefined();
});

test("a signup that fails for any other reason still reports an error", async () => {
  signUp.mockResolvedValue({ data: { user: null, session: null }, error: { status: 400, message: "nope" } });
  const { signUpAction } = await import("@/app/actions/auth");
  const state = await signUpAction({}, form({ email: "new@nestup.dev", password: "goodpassword" }));
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

// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * `signInAction` — the one action that hands out a session.
 *
 * The suspension half of it is covered in `moderation.test.ts` (a suspended
 * account is signed straight back out). What is asserted here is everything
 * around that: the input gate that runs before Supabase is asked anything, the
 * wording of the two failures — which must not be the same sentence, and must
 * not reveal whether an address has an account — and the two things a
 * *successful* sign-in has to do besides authenticate, namely drop the cached
 * "nobody" and refuse to be redirected off-site.
 */

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();
const updateTag = vi.fn();

const supabase = {
  from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })),
  auth: { signInWithPassword, signOut, getUser: vi.fn() },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("next/cache", async () => {
  const stub = await import("../helpers/next-cache-stub");
  return { ...stub, updateTag };
});
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

beforeEach(() => {
  signInWithPassword.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
  maybeSingle.mockReset().mockResolvedValue({ data: null });
  updateTag.mockReset();
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Signs in successfully and reports where the action tried to send the member. */
async function signInTo(next?: string): Promise<string> {
  signInWithPassword.mockResolvedValue({ data: { user: { id: "ok-1" } }, error: null });
  const { signInAction } = await import("@/app/actions/auth");
  try {
    await signInAction({}, form({ email: "ok@nestup.dev", password: "goodpassword", ...(next ? { next } : {}) }));
  } catch (e) {
    return String((e as Error).message).replace("REDIRECT:", "");
  }
  throw new Error("expected a redirect");
}

describe("the gate before Supabase is asked", () => {
  test.each([
    ["a missing address", { email: "", password: "goodpassword" }],
    ["an address with no domain", { email: "dana@", password: "goodpassword" }],
    ["an address with a space in it", { email: "da na@nestup.dev", password: "goodpassword" }],
    ["an empty password", { email: "dana@nestup.dev", password: "" }],
  ])("%s never becomes a login attempt", async (_label, fields) => {
    const { signInAction } = await import("@/app/actions/auth");
    const state = await signInAction({}, form(fields));
    expect(state.error).toBe("Email and password are required.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  test("the address is lower-cased and trimmed, so Dana@ and dana@ are one account", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "ok-1" } }, error: null });
    const { signInAction } = await import("@/app/actions/auth");
    await expect(
      signInAction({}, form({ email: "  Dana@NestUp.dev  ", password: "goodpassword" }))
    ).rejects.toThrow(/REDIRECT:/);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "dana@nestup.dev", password: "goodpassword" });
  });
});

describe("what a refusal is allowed to say", () => {
  /**
   * The sign-in form must not become a way to ask which addresses have an
   * account, so a bad password and an unknown address get the *same* sentence.
   */
  test("a wrong password and an address with no account read identically", async () => {
    const { signInAction } = await import("@/app/actions/auth");

    signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials", status: 400 } });
    const wrongPassword = await signInAction({}, form({ email: "dana@nestup.dev", password: "nope12345" }));

    signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials", status: 400 } });
    const noSuchAccount = await signInAction({}, form({ email: "nobody@nestup.dev", password: "nope12345" }));

    expect(wrongPassword.error).toBe("Wrong email or password.");
    expect(noSuchAccount.error).toBe(wrongPassword.error);
  });

  /**
   * The one failure that IS worth telling apart: the credentials were right and
   * the account simply hasn't been confirmed. "Wrong email or password" there
   * sends someone to reset a password that was never the problem.
   */
  test("an unconfirmed address is sent to its inbox, not to the password reset", async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { code: "email_not_confirmed", status: 400 } });
    const { signInAction } = await import("@/app/actions/auth");
    const state = await signInAction({}, form({ email: "new@nestup.dev", password: "goodpassword" }));

    expect(state.error).toMatch(/confirm your email/i);
    expect(state.error).not.toMatch(/wrong/i);
  });

  test("a refusal never navigates — the member stays on the form with what they typed", async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials" } });
    const { signInAction } = await import("@/app/actions/auth");
    await expect(signInAction({}, form({ email: "dana@nestup.dev", password: "nope12345" }))).resolves.toEqual({
      error: "Wrong email or password.",
    });
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("what a successful sign-in does besides authenticate", () => {
  /**
   * `redirect()` from a Server Action is a soft navigation, so the private
   * cache holding "this browser belongs to nobody" survives it. Without this
   * tag a member who had browsed Listings signed out would go on being served
   * the signed-out header and no hearts for the rest of the cache window.
   */
  test("the cached 'nobody' is dropped before the navigation", async () => {
    const { SESSION_TAG } = await import("@/lib/cache-tags");
    await signInTo();
    expect(updateTag).toHaveBeenCalledWith(SESSION_TAG);
  });

  test("with no ?next= the member lands on Swipe", async () => {
    expect(await signInTo()).toBe("/swipe");
  });

  test("an in-app ?next= is honoured, so a bounced member returns where they were going", async () => {
    expect(await signInTo("/chat/33333333-3333-4333-8333-333333333333")).toBe(
      "/chat/33333333-3333-4333-8333-333333333333"
    );
  });

  /**
   * `sanitizeNextPath` is unit-tested on its own in `redirect.test.ts`; what is
   * asserted here is that this action actually runs the parameter through it.
   * A login form that forwards to wherever `?next=` says is the classic
   * credential-phishing hop, and the middleware puts a `next` on every bounce.
   */
  test.each([
    ["an absolute URL", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example/steal"],
    ["a backslash that browsers resolve off-origin", "/\\evil.example"],
    ["a tab smuggled into a protocol-relative URL", "/\t/evil.example"],
  ])("%s cannot be used to send the member off-site", async (_label, next) => {
    expect(await signInTo(next)).toBe("/swipe");
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The app's own sender for auth mail (`lib/auth-mail.ts`).
 *
 * Two things matter here and both are security-shaped rather than cosmetic.
 * Moving off GoTrue's mailer also moved off its rate limit, so the throttle in
 * this module is the only thing standing between the sign-up form and an open
 * relay out of the project's Gmail account. And the forgot-password form must
 * stay useless as a way to discover which addresses have accounts.
 */
const generateLink = vi.fn();
const sendMail = vi.fn();
let store: Record<string, { last_sent_at: string; sent_count: number }> = {};
let deleted: string[] = [];

function table(name: string) {
  if (name !== "auth_mail_throttle") throw new Error(`unexpected table ${name}`);
  let key = "";
  const api = {
    select: () => api,
    eq: (_col: string, value: string) => {
      key = value;
      return api;
    },
    maybeSingle: async () => ({ data: store[key] ?? null }),
    upsert: async (row: { email_hash: string; last_sent_at: string; sent_count: number }) => {
      store[row.email_hash] = { last_sent_at: row.last_sent_at, sent_count: row.sent_count };
      return { error: null };
    },
    delete: () => ({
      lt: async (_col: string, cutoff: string) => {
        deleted.push(cutoff);
        return { error: null };
      },
    }),
  };
  return api;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: table, auth: { admin: { generateLink } } }),
}));
vi.mock("@/lib/mail", () => ({ sendMail }));

const OTP = { properties: { email_otp: "123456", hashed_token: "hash-abc" }, user: { id: "u1" } };
const SITE = "https://nestup-kappa.vercel.app";

beforeEach(() => {
  store = {};
  deleted = [];
  generateLink.mockReset().mockResolvedValue({ data: OTP, error: null });
  sendMail.mockReset().mockResolvedValue(true);
});

describe("sendConfirmationMail", () => {
  test("mints a code without asking Supabase to send, then sends it multipart", async () => {
    const { sendConfirmationMail } = await import("@/lib/auth-mail");
    const r = await sendConfirmationMail("new@nestup.dev", SITE, "goodpassword");
    expect(r).toEqual({ status: "sent" });
    expect(generateLink).toHaveBeenCalledWith({ type: "signup", email: "new@nestup.dev", password: "goodpassword" });

    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe("new@nestup.dev");
    // The whole point of the change: a text part alongside the HTML.
    expect(mail.text).toContain("123456");
    expect(mail.html).toContain("123456");
    expect(mail.text.length).toBeGreaterThan(50);
  });

  test("a resend supplies a throwaway password rather than none at all", async () => {
    const { sendConfirmationMail } = await import("@/lib/auth-mail");
    await sendConfirmationMail("new@nestup.dev", SITE);
    const arg = generateLink.mock.calls[0][0];
    expect(arg.password).toEqual(expect.any(String));
    expect(arg.password.length).toBeGreaterThan(8);
  });

  test("a confirmed account is reported as taken and nothing is sent", async () => {
    generateLink.mockResolvedValue({ data: null, error: { status: 422, code: "email_exists", message: "already registered" } });
    const { sendConfirmationMail } = await import("@/lib/auth-mail");
    expect(await sendConfirmationMail("taken@nestup.dev", SITE, "pw")).toEqual({ status: "taken" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  test("a mail that fails to go out is an error, never a silent success", async () => {
    sendMail.mockResolvedValue(false);
    const { sendConfirmationMail } = await import("@/lib/auth-mail");
    expect(await sendConfirmationMail("new@nestup.dev", SITE, "pw")).toEqual({ status: "error" });
  });

  test("a response with no code is an error rather than an empty mail", async () => {
    generateLink.mockResolvedValue({ data: { properties: {} }, error: null });
    const { sendConfirmationMail } = await import("@/lib/auth-mail");
    expect(await sendConfirmationMail("new@nestup.dev", SITE, "pw")).toEqual({ status: "error" });
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("the throttle — the replacement for GoTrue's rate limit", () => {
  test("a second request inside the window is refused with the seconds left", async () => {
    const { sendConfirmationMail, THROTTLE_SECONDS } = await import("@/lib/auth-mail");
    expect(await sendConfirmationMail("a@nestup.dev", SITE, "pw")).toEqual({ status: "sent" });

    const second = await sendConfirmationMail("a@nestup.dev", SITE, "pw");
    expect(second.status).toBe("throttled");
    if (second.status === "throttled") {
      expect(second.seconds).toBeGreaterThan(0);
      expect(second.seconds).toBeLessThanOrEqual(THROTTLE_SECONDS);
    }
    expect(sendMail).toHaveBeenCalledTimes(1); // the second never reached the relay
  });

  test("the window is per address, so one member cannot block another", async () => {
    const { sendConfirmationMail } = await import("@/lib/auth-mail");
    await sendConfirmationMail("a@nestup.dev", SITE, "pw");
    expect(await sendConfirmationMail("b@nestup.dev", SITE, "pw")).toEqual({ status: "sent" });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  test("case and surrounding space cannot be used to slip past it", async () => {
    const { sendConfirmationMail } = await import("@/lib/auth-mail");
    await sendConfirmationMail("a@nestup.dev", SITE, "pw");
    const dodged = await sendConfirmationMail("  A@NestUp.dev  ", SITE, "pw");
    expect(dodged.status).toBe("throttled");
  });

  test("once the window has passed the next request goes through", async () => {
    const { sendConfirmationMail, THROTTLE_SECONDS } = await import("@/lib/auth-mail");
    await sendConfirmationMail("a@nestup.dev", SITE, "pw");
    for (const row of Object.values(store)) {
      row.last_sent_at = new Date(Date.now() - (THROTTLE_SECONDS + 5) * 1000).toISOString();
    }
    expect(await sendConfirmationMail("a@nestup.dev", SITE, "pw")).toEqual({ status: "sent" });
  });

  test("addresses are stored hashed, never in the clear", async () => {
    const { sendConfirmationMail } = await import("@/lib/auth-mail");
    await sendConfirmationMail("secret@nestup.dev", SITE, "pw");
    const keys = Object.keys(store);
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain("secret");
    expect(keys[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sendRecoveryMail", () => {
  test("links to the app's own confirm route, the shape that route already parses", async () => {
    const { sendRecoveryMail } = await import("@/lib/auth-mail");
    expect(await sendRecoveryMail("noa@nestup.dev", SITE)).toEqual({ status: "sent" });
    const mail = sendMail.mock.calls[0][0];
    const link = `${SITE}/auth/confirm?token_hash=hash-abc&type=recovery`;
    // The text part carries the URL literally; the HTML carries it with the
    // separator escaped, which is what an `href` is supposed to contain — mail
    // clients decode it back before following the link.
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(link.replace("&", "&amp;"));
    expect(mail.html).toContain('href="https://nestup-kappa.vercel.app/auth/confirm?token_hash=hash-abc&amp;type=recovery"');
  });

  test("an address with no account is reported as sent, with nothing sent", async () => {
    generateLink.mockResolvedValue({ data: null, error: { status: 404, code: "user_not_found", message: "not found" } });
    const { sendRecoveryMail } = await import("@/lib/auth-mail");
    // Anything else here would turn the forgot-password form into a way of
    // discovering which addresses have accounts.
    expect(await sendRecoveryMail("nobody@nestup.dev", SITE)).toEqual({ status: "sent" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  test("a trailing slash on the site never doubles up in the link", async () => {
    const { sendRecoveryMail } = await import("@/lib/auth-mail");
    await sendRecoveryMail("noa@nestup.dev", `${SITE}/`);
    expect(sendMail.mock.calls[0][0].html).not.toContain("//auth/confirm");
  });
});

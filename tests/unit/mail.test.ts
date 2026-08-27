// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";

/**
 * The mail transport. Its one hard rule: sending must never throw into the
 * caller — an e-mail that fails is not allowed to fail a member's action.
 */
const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const SMTP = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "587",
  SMTP_USER: "nestup@example.com",
  SMTP_PASS: "app-password",
  SMTP_SENDER_EMAIL: "nestup@example.com",
  SMTP_SENDER_NAME: "NestUp",
};

beforeEach(() => {
  vi.resetModules();
  sendMail.mockReset().mockResolvedValue({ messageId: "1" });
  createTransport.mockClear();
  for (const k of Object.keys(SMTP)) delete process.env[k];
});
afterEach(() => {
  for (const k of Object.keys(SMTP)) delete process.env[k];
});

test("without SMTP settings it does nothing and reports it did not send", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { sendMail: send } = await import("@/lib/mail");
  await expect(send({ to: "a@b.co", subject: "Hi", html: "<p>Hi</p>" })).resolves.toBe(false);
  expect(createTransport).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("with SMTP settings it sends once, from the configured sender", async () => {
  Object.assign(process.env, SMTP);
  const { sendMail: send } = await import("@/lib/mail");
  await expect(send({ to: "a@b.co", subject: "Hi", html: "<p>Hi</p>" })).resolves.toBe(true);
  expect(createTransport).toHaveBeenCalledTimes(1);
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: '"NestUp" <nestup@example.com>',
      to: "a@b.co",
      subject: "Hi",
      html: "<p>Hi</p>",
    })
  );
});

test("a transport failure is swallowed, never thrown at the caller", async () => {
  Object.assign(process.env, SMTP);
  sendMail.mockRejectedValue(new Error("connection refused"));
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { sendMail: send } = await import("@/lib/mail");
  await expect(send({ to: "a@b.co", subject: "Hi", html: "<p>Hi</p>" })).resolves.toBe(false);
  error.mockRestore();
});

test("every message carries a plain-text alternative — HTML-only mail scores as spam", async () => {
  Object.assign(process.env, SMTP);
  const { sendMail: send } = await import("@/lib/mail");
  await send({ to: "a@b.co", subject: "Hi", html: "<p>Hello <a href='https://nestup-kappa.vercel.app/x'>the room</a></p>" });
  const sentArgs = sendMail.mock.calls[0][0];
  expect(sentArgs.text).toBeTruthy();
  expect(sentArgs.text).toContain("Hello");
  // the link has to survive into the text part, or it reads as a dead sentence
  expect(sentArgs.text).toContain("https://nestup-kappa.vercel.app/x");
  expect(sentArgs.text).not.toContain("<p>");
});

test("a supplied text part is used as given", async () => {
  Object.assign(process.env, SMTP);
  const { sendMail: send } = await import("@/lib/mail");
  await send({ to: "a@b.co", subject: "Hi", html: "<p>ignored</p>", text: "written by hand" });
  expect(sendMail.mock.calls[0][0].text).toBe("written by hand");
});

test("an unsubscribe URL becomes a List-Unsubscribe header", async () => {
  Object.assign(process.env, SMTP);
  const { sendMail: send } = await import("@/lib/mail");
  await send({ to: "a@b.co", subject: "Hi", html: "<p>Hi</p>", unsubscribeUrl: "https://nestup-kappa.vercel.app/settings" });
  const headers = sendMail.mock.calls[0][0].headers;
  expect(headers["List-Unsubscribe"]).toBe("<https://nestup-kappa.vercel.app/settings>");
});

test("without an unsubscribe URL no such header is invented", async () => {
  Object.assign(process.env, SMTP);
  const { sendMail: send } = await import("@/lib/mail");
  await send({ to: "a@b.co", subject: "Hi", html: "<p>Hi</p>" });
  expect(sendMail.mock.calls[0][0].headers?.["List-Unsubscribe"]).toBeUndefined();
});

test("replies go somewhere a person reads, not into the void", async () => {
  Object.assign(process.env, SMTP);
  const { sendMail: send } = await import("@/lib/mail");
  await send({ to: "a@b.co", subject: "Hi", html: "<p>Hi</p>" });
  expect(sendMail.mock.calls[0][0].replyTo).toBe("nestup@example.com");
});

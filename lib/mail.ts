import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing mail. The transport is the same Gmail account
 * `scripts/auth-config.mjs` gives Supabase Auth for its confirmation and reset
 * messages (`SMTP_*` in `.env.local`), so nothing new has to be signed up for.
 *
 * Two rules hold everywhere this is used:
 *  - with no SMTP settings it is a no-op, so local dev, CI and the test suite
 *    never try to reach a mail server;
 *  - it never throws. A failed e-mail must not fail the action that triggered
 *    it — publishing a room succeeds whether or not the alert goes out.
 */
let cached: Transporter | null = null;

function transport(): Transporter | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT ?? 587);
  cached ??= nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 587 is STARTTLS, upgraded after the greeting
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cached;
}

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const t = transport();
  if (!t) {
    console.warn("[mail] SMTP_* not configured — skipping", { to, subject });
    return false;
  }
  const name = process.env.SMTP_SENDER_NAME || "NestUp";
  const from = `"${name}" <${process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER}>`;
  try {
    await t.sendMail({ from, to, subject, html });
    return true;
  } catch (e) {
    console.error("[mail] send failed", e);
    return false;
  }
}

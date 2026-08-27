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
 *
 * Inbox placement (2026-08-27): every message goes out as multipart —
 * HTML-only mail is one of the strongest junk signals a small sender can give
 * off — with a Reply-To that a person actually reads, and a List-Unsubscribe
 * header on anything a member opted into. None of this can *guarantee* the
 * inbox; the receiving provider decides. The remaining lever is the sending
 * domain, which is a personal Gmail address today.
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

/**
 * Last-resort plain-text version of an HTML mail. Keeps every link's URL —
 * a text part whose links have been stripped reads as a dead end, which is
 * worse than no text part at all.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return text && !text.includes(href) ? `${text}: ${href}` : href;
    })
    .replace(/<(?:br|\/p|\/div|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&middot;/gi, "·")
    .replace(/&mdash;/gi, "—")
    .replace(/&rsquo;/gi, "’")
    .replace(/&#8362;/gi, "₪")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export async function sendMail({
  to,
  subject,
  html,
  text,
  unsubscribeUrl,
}: {
  to: string;
  subject: string;
  html: string;
  /** Written by hand where the wording matters; derived from the HTML otherwise. */
  text?: string;
  /** Opt-in mail only: where the member turns this kind of message off. */
  unsubscribeUrl?: string;
}): Promise<boolean> {
  const t = transport();
  if (!t) {
    console.warn("[mail] SMTP_* not configured — skipping", { to, subject });
    return false;
  }
  const name = process.env.SMTP_SENDER_NAME || "NestUp";
  const sender = process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || "";
  const from = `"${name}" <${sender}>`;
  // A one-click header is deliberately NOT claimed: List-Unsubscribe-Post
  // promises an endpoint that unsubscribes on POST alone, and /settings is a
  // page a member has to sign in to. Promising it and not honouring it is
  // worse for reputation than leaving it off.
  const headers = unsubscribeUrl ? { "List-Unsubscribe": `<${unsubscribeUrl}>` } : undefined;
  try {
    await t.sendMail({
      from,
      replyTo: sender,
      to,
      subject,
      html,
      text: text ?? htmlToText(html),
      ...(headers ? { headers } : {}),
    });
    return true;
  } catch (e) {
    console.error("[mail] send failed", e);
    return false;
  }
}

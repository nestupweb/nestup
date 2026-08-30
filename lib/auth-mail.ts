import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sendMail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONFIRMATION_SUBJECT,
  EMAIL_CHANGE_SUBJECT,
  RECOVERY_SUBJECT,
  renderConfirmationHtml,
  renderConfirmationText,
  renderEmailChangeHtml,
  renderEmailChangeText,
  renderRecoveryHtml,
  renderRecoveryText,
} from "@/lib/email/auth";

/**
 * Sign-up confirmation and password-reset e-mail, sent by the app rather than
 * by Supabase Auth.
 *
 * Why: measured on production on 2026-08-29, from one Gmail account, minutes
 * apart — a multipart message from `lib/mail.ts` reached the inbox, and
 * Supabase's HTML-only confirmation went to spam. GoTrue's mailer has no way
 * to add a text part, so the only fix is to stop asking it to send.
 *
 * How: `admin.generateLink` mints the same code and token GoTrue would have
 * mailed, and returns them WITHOUT sending anything. The message that follows
 * is ours, multipart, with a real Reply-To.
 *
 * The templates in `supabase/templates/` stay uploaded and in step: if these
 * calls ever fail closed, Supabase's own mail is the fallback.
 */

/** One message per address per minute, replacing GoTrue's `smtp_max_frequency`. */
export const THROTTLE_SECONDS = 60;

export type AuthMailResult =
  /** Sent, or deliberately treated as sent so the form reveals nothing. */
  | { status: "sent" }
  /** A confirmed account already owns this address. */
  | { status: "taken" }
  /** Asked again too soon; `seconds` is how long is left to wait. */
  | { status: "throttled"; seconds: number }
  | { status: "error" };

/** Addresses are never stored in the clear — see migration 0036. */
const hash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Claims the right to send to this address, or reports how long is left.
 *
 * Two concurrent requests can both pass this check — it is a read followed by
 * a write, not an atomic one. That is accepted deliberately: the cost of the
 * race is one duplicate e-mail, and the thing being defended against is a
 * flood, which this still stops.
 */
async function claimSend(admin: Admin, email: string): Promise<number | null> {
  const key = hash(email);
  const { data } = await admin
    .from("auth_mail_throttle")
    .select("last_sent_at, sent_count")
    .eq("email_hash", key)
    .maybeSingle();

  if (data) {
    const elapsed = (Date.now() - Date.parse(data.last_sent_at as string)) / 1000;
    if (elapsed < THROTTLE_SECONDS) return Math.max(1, Math.ceil(THROTTLE_SECONDS - elapsed));
  }
  await admin.from("auth_mail_throttle").upsert(
    {
      email_hash: key,
      last_sent_at: new Date().toISOString(),
      sent_count: ((data?.sent_count as number | undefined) ?? 0) + 1,
    },
    { onConflict: "email_hash" }
  );
  return null;
}

/** Trims the table opportunistically, so no scheduled job is needed. */
async function sweep(admin: Admin): Promise<void> {
  if (Math.random() > 0.02) return; // ~1 call in 50
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await admin.from("auth_mail_throttle").delete().lt("last_sent_at", cutoff);
}

/**
 * Create the account if it is new, re-issue the code if it exists but was
 * never confirmed, and report `taken` if a confirmed account owns the address.
 *
 * `password` is optional because a resend has no way to know it. Passing a
 * throwaway is safe: verified against the live project on 2026-08-29, a second
 * `generateLink({type:"signup"})` for an existing unconfirmed user re-issues
 * the code and LEAVES THE STORED PASSWORD ALONE — the original still signs in
 * and the throwaway does not. If that ever changes, a resend would silently
 * reset the member's password, so re-test this before touching it.
 */
export async function sendConfirmationMail(
  email: string,
  site: string,
  password?: string
): Promise<AuthMailResult> {
  const admin = createAdminClient();
  if (!admin) return { status: "error" };

  const waiting = await claimSend(admin, email);
  if (waiting !== null) return { status: "throttled", seconds: waiting };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: password ?? `${randomBytes(24).toString("base64url")}Aa1!`,
  });
  if (error) {
    // 422 email_exists is only ever a CONFIRMED account: an unconfirmed one
    // re-issues above instead of failing.
    if (error.status === 422 || error.code === "email_exists") return { status: "taken" };
    console.error("[auth-mail] generateLink signup failed", error.message);
    return { status: "error" };
  }

  const code = data?.properties?.email_otp;
  if (!code) return { status: "error" };

  const sent = await sendMail({
    to: email,
    subject: CONFIRMATION_SUBJECT,
    html: renderConfirmationHtml(code, email, site),
    text: renderConfirmationText(code, email, site),
  });
  await sweep(admin);
  return sent ? { status: "sent" } : { status: "error" };
}

/**
 * The "confirm your new e-mail" code, sent ONLY to the new address.
 *
 * Requires `mailer_secure_email_change_enabled: false` (`scripts/auth-config.mjs`):
 * with it on, GoTrue also mails the OLD address and won't finish the change
 * until that link is clicked too. `generateLink({ type: "email_change_new" })`
 * mints the new address's code — the same one Supabase's own dual-mail flow
 * would have sent — without asking Supabase to mail anything, exactly like
 * `sendConfirmationMail` does for signup. `verifyOtp({ email: newEmail, token,
 * type: "email_change" })` is what completes the change.
 */
export async function sendEmailChangeMail(
  currentEmail: string,
  newEmail: string,
  site: string
): Promise<AuthMailResult> {
  const admin = createAdminClient();
  if (!admin) return { status: "error" };

  const waiting = await claimSend(admin, newEmail);
  if (waiting !== null) return { status: "throttled", seconds: waiting };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "email_change_new",
    email: currentEmail,
    newEmail,
  });
  if (error) {
    // Same case as signup: the new address already belongs to a CONFIRMED account.
    if (error.status === 422 || error.code === "email_exists") return { status: "taken" };
    console.error("[auth-mail] generateLink email_change_new failed", error.message);
    return { status: "error" };
  }

  const code = data?.properties?.email_otp;
  if (!code) return { status: "error" };

  const sent = await sendMail({
    to: newEmail,
    subject: EMAIL_CHANGE_SUBJECT,
    html: renderEmailChangeHtml(code, newEmail, site),
    text: renderEmailChangeText(code, newEmail, site),
  });
  await sweep(admin);
  return sent ? { status: "sent" } : { status: "error" };
}

/**
 * The password-reset mail. An address with no account is reported as sent and
 * nothing goes out — the forgot-password form must not become a way to find
 * out which addresses exist, which is the behaviour it had under Supabase's
 * mailer and the behaviour it keeps here.
 */
export async function sendRecoveryMail(email: string, site: string): Promise<AuthMailResult> {
  const admin = createAdminClient();
  if (!admin) return { status: "error" };

  const waiting = await claimSend(admin, email);
  if (waiting !== null) return { status: "throttled", seconds: waiting };

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) {
    if (error.status === 404 || error.code === "user_not_found") return { status: "sent" };
    console.error("[auth-mail] generateLink recovery failed", error.message);
    return { status: "error" };
  }

  const token = data?.properties?.hashed_token;
  if (!token) return { status: "error" };
  // The same URL shape `supabase/templates/recovery.html` used, so
  // `app/auth/confirm/route.ts` needs no change.
  const link = `${site.replace(/\/$/, "")}/auth/confirm?token_hash=${token}&type=recovery`;

  const sent = await sendMail({
    to: email,
    subject: RECOVERY_SUBJECT,
    html: renderRecoveryHtml(link, email, site),
    text: renderRecoveryText(link, email, site),
  });
  await sweep(admin);
  return sent ? { status: "sent" } : { status: "error" };
}

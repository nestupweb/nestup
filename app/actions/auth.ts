"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendConfirmationMail, sendEmailChangeMail, sendRecoveryMail } from "@/lib/auth-mail";
import { requireUser } from "@/lib/auth";
import { sanitizeNextPath } from "@/lib/redirect";
import { SUSPENDED_MESSAGE } from "@/lib/moderation";

export type AuthState = {
  error?: string;
  sent?: boolean;
  email?: string;
  throttled?: boolean;
  /** The address already has an account — the screen offers Log in / reset alongside the error. */
  taken?: boolean;
};

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Shape of the errors Supabase hands back; `code` is absent on older ones. */
type AuthError = { status?: number; code?: string; message?: string };

/**
 * Supabase sends at most one auth mail per address per minute
 * (`smtp_max_frequency`) and 30 an hour project-wide, and answers anything
 * over that with 429 `over_email_send_rate_limit`. That is a "wait", never a
 * "this address is unusable".
 */
const isSendRateLimit = (error: AuthError) =>
  error.status === 429 || error.code === "over_email_send_rate_limit";

/** "…you can only request this after 47 seconds." → 47, so the screen can say how long. */
function retryAfterSeconds(message: string | undefined): number | null {
  const m = /after (\d+) seconds?/i.exec(message ?? "");
  return m ? Number(m[1]) : null;
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!emailOk(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  // The form disables its own submit on a mismatch, but the form is not the
  // only way to reach this action, and a typo'd password on an account that
  // needs an e-mail round-trip to reset is an expensive thing to let through.
  if (password !== confirm) return { error: "The two passwords don't match." };

  // The account and its confirmation code are created together by
  // `sendConfirmationMail`, which then sends the mail itself. Supabase's own
  // mailer is no longer asked to send: it offers no plain-text part, and on
  // 2026-08-29 that was measured putting this exact message in spam while a
  // multipart one from the same account reached the inbox.
  //
  // This also replaces the decoy-user check that used to live here. Supabase's
  // enumeration protection answered `signUp` for a taken address with 200 and
  // an empty `identities` array; `generateLink` is explicit instead, failing
  // with 422 `email_exists` for a CONFIRMED account and quietly re-issuing the
  // code for one that was never confirmed. Same outcomes, stated directly.
  const site = await requestOrigin();
  const result = await sendConfirmationMail(email, site, password);
  if (result.status === "taken") {
    return { error: "That email is already in use.", taken: true, email };
  }
  // Pressing Sign up again while waiting for the first mail lands inside the
  // one-per-minute window. The account is already there and a code is already
  // on its way, so this is the "check your inbox" case — telling the member to
  // try a different address would send them off to build a second account they
  // don't need.
  if (result.status === "throttled") return { sent: true, email, throttled: true };
  if (result.status === "error") {
    return { error: "Could not create the account. Try a different email." };
  }
  // Email confirmation is ON (`mailer_autoconfirm: false`), so the row exists
  // but there is no session: the account cannot be used until the code is
  // entered. The address travels back so the next screen can name it — a typo
  // is the main reason a confirmation never arrives.
  return { sent: true, email };
}

/**
 * "Didn't get it? Send it again." Supabase throttles one message per address
 * per minute (`smtp_max_frequency: 60`), so a too-soon retry is reported as
 * something to wait out rather than a failure.
 */
export async function resendConfirmationAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailOk(email)) return { error: "Please enter a valid email address." };

  // No password here — a resend has no way to know it. `sendConfirmationMail`
  // supplies a throwaway, which is safe because re-issuing a signup link for
  // an unconfirmed account leaves the stored password untouched (verified
  // against the live project; see the note on that function).
  const site = await requestOrigin();
  const result = await sendConfirmationMail(email, site);
  if (result.status === "throttled") {
    return { error: `We just sent one — try again in ${result.seconds} seconds.` };
  }
  if (result.status === "error") {
    return { error: "Could not send it again. Please try in a moment." };
  }
  // An address that is already confirmed comes back `taken`, and is reported
  // here as success with nothing sent — the form must not become a way to find
  // out which addresses exist. "Already confirmed? Log in" on the screen is the
  // way out of that, and it is shown to everyone rather than only to that case.
  return { sent: true, email };
}

/**
 * Second half of sign-up: the six-digit code from the confirmation e-mail.
 * `verifyOtp` with type "email" both confirms the address and returns a
 * session, so a correct code lands the member straight in onboarding — no
 * second login, and no emailed link to lose.
 */
export async function verifyCodeAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!emailOk(email)) return { error: "Please enter a valid email address.", email };
  if (code.length !== 6) return { error: "Enter the 6-digit code from the email.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    // GoTrue answers a wrong code and an expired one the same way, so the
    // message has to cover both without guessing which it was.
    if (isSendRateLimit(error)) {
      const seconds = retryAfterSeconds(error.message);
      return { error: seconds ? `Too many tries — wait ${seconds} seconds.` : "Too many tries — wait a minute.", email };
    }
    return { error: "That code is wrong or has expired. Check the email, or send a new one.", email };
  }
  redirect("/profile?onboarding=1");
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/swipe";
  if (!emailOk(email) || password.length === 0) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first — check your inbox." };
    }
    return { error: "Wrong email or password." };
  }

  // The credentials were right, so a session now exists — a suspended account
  // must not keep it. Checked after sign-in rather than before because
  // `suspensions` is readable only by its owner (migration 0029), which is
  // also what stops this being a way to ask whether someone is suspended.
  const signedInId = data.user?.id;
  if (signedInId) {
    const { data: suspension } = await supabase
      .from("suspensions")
      .select("user_id")
      .eq("user_id", signedInId)
      .maybeSingle();
    if (suspension) {
      await supabase.auth.signOut();
      return { error: SUSPENDED_MESSAGE };
    }
  }
  redirect(sanitizeNextPath(next));
}

/**
 * Signing out lives in `app/auth/signout/route.ts`, not here.
 *
 * It has to end in a full document load: a Server Action's `redirect()` is a
 * soft navigation, so the member's cached deck, inbox and profile tabs — and
 * the router's rendered copies of those pages — survived it in the tab. A
 * Route Handler answering 303 rebuilds the client from nothing, which is the
 * only thing that clears them.
 */

/**
 * Public origin the reset link should come back to. `NEXT_PUBLIC_SITE_URL`
 * wins; otherwise the request's own host. A spoofed Host header can't send
 * the link anywhere harmful: Supabase only honours `redirectTo` values on its
 * allow-list and falls back to the project's Site URL for anything else.
 */
async function requestOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * "Forgot my password": email a recovery link that lands on /auth/confirm and
 * from there on /reset-password. Always reports "sent" (except when throttled)
 * so the form can't be used to find out which addresses have an account.
 */
export async function requestPasswordResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailOk(email)) return { error: "Please enter a valid email address." };

  const origin = await requestOrigin();
  const result = await sendRecoveryMail(email, origin);
  if (result.status === "throttled") {
    return { error: `We just sent one — try again in ${result.seconds} seconds.` };
  }
  // An address with no account also comes back "sent", with nothing sent.
  return { sent: true };
}

/** Second half of the reset: the recovery link signed the user in, now set the new password. */
export async function updatePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=recovery");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password you haven't used before." };
    return { error: "Could not update the password. Request a new reset link and try again." };
  }
  redirect("/swipe");
}

export type AccountState = { error?: string; sent?: boolean; done?: boolean; email?: string };

/**
 * Change the address the account signs in with. A 6-digit code goes ONLY to
 * the NEW address (`sendEmailChangeMail`) and nothing moves until it is
 * entered on this same page, so the member can't lock themselves out with a
 * typo. The old address hears about the request separately — see
 * `mailer_notifications_email_changed_enabled` in `scripts/auth-config.mjs`.
 */
export async function changeEmailAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailOk(email)) return { error: "Please enter a valid email address." };

  const { user } = await requireUser();
  if (email === (user.email ?? "").toLowerCase()) return { error: "That's already your e-mail address." };

  const site = await requestOrigin();
  const result = await sendEmailChangeMail(user.email ?? "", email, site);
  if (result.status === "taken") return { error: "That email is already in use." };
  if (result.status === "throttled") {
    return { error: `We just sent one — try again in ${result.seconds} seconds.` };
  }
  if (result.status === "error") return { error: "Could not send the code. Try again in a moment." };
  return { sent: true, email };
}

/** "Didn't get it? Send it again." — kept in its own state, same reason `resendConfirmationAction` is: a throttled resend must not blank out the code screen the member is already on. */
export async function resendEmailChangeCodeAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailOk(email)) return { error: "Please enter a valid email address." };

  const { user } = await requireUser();
  const site = await requestOrigin();
  const result = await sendEmailChangeMail(user.email ?? "", email, site);
  if (result.status === "taken") return { error: "That email is already in use." };
  if (result.status === "throttled") {
    return { error: `We just sent one — try again in ${result.seconds} seconds.` };
  }
  if (result.status === "error") return { error: "Could not send it again. Please try in a moment." };
  return { sent: true, email };
}

/**
 * Second half of an e-mail change: the code from `sendEmailChangeMail`.
 * `verifyOtp` with type "email_change" both confirms the new address and
 * completes the switch — no link, no second screen.
 */
export async function verifyEmailChangeCodeAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Enter the 6-digit code from the email.", email };

  const { supabase } = await requireUser();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email_change" });
  if (error) {
    if (isSendRateLimit(error)) {
      const seconds = retryAfterSeconds(error.message);
      return { error: seconds ? `Too many tries — wait ${seconds} seconds.` : "Too many tries — wait a minute.", email };
    }
    return { error: "That code is wrong or has expired. Send a new one.", email };
  }
  // Settings reads the session's address fresh on every render, so rerunning
  // this route shows the new one. Nothing cached carries the e-mail address.
  refresh();
  return { done: true };
}

/**
 * Change the password from Settings. Supabase would let a live session set a
 * new password without the old one; we ask for it anyway, so someone at a
 * borrowed unlocked laptop can't lock the owner out of their own account.
 */
export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const { supabase, user } = await requireUser();
  const { error: reauth } = await supabase.auth.signInWithPassword({
    email: user.email ?? "",
    password: current,
  });
  if (reauth) return { error: "Your current password is not correct." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password you haven't used before." };
    return { error: "Could not update the password. Please try again." };
  }
  return { done: true };
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  if (!emailOk(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    // Pressing Sign up again while waiting for the first mail lands inside the
    // one-per-minute window. The account is already there and a link is
    // already on its way, so this is the "check your inbox" case — telling the
    // member to try a different address would send them off to build a second
    // account they don't need.
    if (isSendRateLimit(error)) return { sent: true, email, throttled: true };
    return { error: "Could not create the account. Try a different email." };
  }
  // Supabase's e-mail enumeration protection never fails a sign-up for an
  // address that is already taken — it answers 200 with a decoy user: a random
  // id, no session, and, the one tell, an empty `identities` array. Without
  // this the member is sent to "Check your inbox" to wait for a mail that is
  // never coming. Measured against the live project: a new address comes back
  // with its "email" identity, a confirmed account comes back with none, and
  // an account that exists but was never confirmed comes back with its real
  // identity and a fresh link already sent — which is the inbox screen below,
  // not this. `identities` missing entirely is treated as "not taken", so an
  // API change can only cost the warning, never invent one.
  if (data.user?.identities?.length === 0) {
    return { error: "That email is already in use.", taken: true, email };
  }
  // Email confirmation is ON (`mailer_autoconfirm: false`), so signUp creates the
  // row but no session: the account cannot be used until the emailed link is
  // clicked. The address travels back so the next screen can name it — a typo
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

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    if (isSendRateLimit(error)) {
      const seconds = retryAfterSeconds(error.message);
      return {
        error: seconds
          ? `We just sent one — try again in ${seconds} seconds.`
          : "We just sent one — give it a minute before asking again.",
      };
    }
    return { error: "Could not send it again. Please try in a moment." };
  }
  // An address that is already confirmed also comes back clean here (Supabase
  // answers 200 and sends nothing, so the form can't be used to find out which
  // addresses exist). "Already confirmed? Log in" on the screen is the way out
  // of that, and it is shown to everyone rather than only to that case.
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

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

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

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (error && error.status === 429) {
    return { error: "Too many requests — please wait a few minutes and try again." };
  }
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

export type AccountState = { error?: string; sent?: boolean; done?: boolean };

/**
 * Change the address the account signs in with. Supabase mails a confirmation
 * link to the NEW address and nothing moves until it is clicked, so the member
 * can't lock themselves out with a typo.
 */
export async function changeEmailAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailOk(email)) return { error: "Please enter a valid email address." };

  const { supabase, user } = await requireUser();
  if (email === (user.email ?? "").toLowerCase()) return { error: "That's already your e-mail address." };

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    // Same one-per-minute window as sign-up: a second attempt inside it is a
    // wait, not a bad address, and the confirmation is already on its way.
    if (isSendRateLimit(error)) {
      const seconds = retryAfterSeconds(error.message);
      return {
        error: seconds
          ? `We just mailed that address — try again in ${seconds} seconds.`
          : "We just mailed that address — give it a minute before asking again.",
      };
    }
    return { error: "Could not change the email. Try a different address." };
  }
  return { sent: true };
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

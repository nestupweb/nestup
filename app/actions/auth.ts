"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { sanitizeNextPath } from "@/lib/redirect";

export type AuthState = { error?: string; sent?: boolean };

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!emailOk(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: "Could not create the account. Try a different email." };
  // Email confirmation is ON: no session yet — the user must click the emailed link.
  return { sent: true };
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/swipe";
  if (!emailOk(email) || password.length === 0) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first — check your inbox." };
    }
    return { error: "Wrong email or password." };
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
  if (error) return { error: "Could not change the email. Try a different address." };
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

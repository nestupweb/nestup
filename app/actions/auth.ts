"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

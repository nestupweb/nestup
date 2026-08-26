"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "@/app/actions/auth";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { formClass, inputClass, labelClass, submitClass } from "@/components/auth/fields";

export function AuthForm({
  mode,
  action,
  next,
  notice,
}: {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
  notice?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  if (state.sent) {
    return (
      <div className="mx-auto mt-16 w-full max-w-md px-4 text-center sm:px-6">
        <h1 className="text-3xl font-bold">Check your inbox</h1>
        <p className="mt-3 text-sm text-muted">
          We sent you a confirmation link. Click it to activate your account, then log in.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm text-accent underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className={formClass}>
      <h1 className="text-3xl font-bold">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "login" ? "Log in to keep swiping." : "You'll confirm your email in one click."}
      </p>

      {notice ? <p role="status" className="mt-3 text-sm text-accent">{notice}</p> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className={labelClass}>
        Email
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className={labelClass}>
        Password
        <PasswordInput
          name="password" required minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={inputClass}
        />
      </label>
      {mode === "login" ? (
        <p className="mt-2 text-right text-xs">
          <Link href="/forgot-password" className="text-accent underline">Forgot your password?</Link>
        </p>
      ) : null}

      {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "One moment…" : mode === "login" ? "Log in" : "Sign up"}
      </button>

      <p className="mt-4 text-sm text-muted">
        {mode === "login" ? (
          <>New here? <Link href="/signup" className="text-accent underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="text-accent underline">Log in</Link></>
        )}
      </p>
    </form>
  );
}

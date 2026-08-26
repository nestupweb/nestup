"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "@/app/actions/auth";
import { formClass, inputClass, labelClass, submitClass } from "@/components/auth/fields";

export function ForgotPasswordForm({
  action,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  if (state.sent) {
    return (
      <div className="mx-auto mt-16 w-full max-w-md px-4 text-center sm:px-6">
        <h1 className="text-3xl font-bold">Check your inbox</h1>
        <p className="mt-3 text-sm text-muted">
          If there&rsquo;s an account for that email, we sent it a link to set a new password.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm text-accent underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className={formClass}>
      <h1 className="text-3xl font-bold">Forgot your password?</h1>
      <p className="mt-1 text-sm text-muted">
        Enter your email and we&rsquo;ll send you a link to set a new one.
      </p>

      <label className={labelClass}>
        Email
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>

      {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "One moment…" : "Send reset link"}
      </button>

      <p className="mt-4 text-sm text-muted">
        Remembered it? <Link href="/login" className="text-accent underline">Back to log in</Link>
      </p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { resendConfirmationAction, type AuthState } from "@/app/actions/auth";
import { useStickyForm } from "@/lib/hooks";
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
  const [state, form, pending] = useStickyForm<AuthState>(action, {});

  if (state.sent) {
    // Signing up does not create a session: the account stays unusable until the
    // emailed link is clicked. The two ways to get stranded here are a mail that
    // never lands and a mistyped address, so name the address and offer both ways out.
    return <CheckInbox email={state.email ?? ""} mode={mode} />;
  }

  return (
    <form {...form} className={formClass}>
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

/**
 * The wall between signing up and using NestUp: nothing works until the
 * emailed link is clicked. Shows which address it went to, can send it again
 * (Supabase allows one per minute), and offers a way back for a typo.
 */
function CheckInbox({ email, mode }: { email: string; mode: "login" | "signup" }) {
  const [state, resendForm, pending] = useStickyForm<AuthState>(resendConfirmationAction, {});

  return (
    <div className="mx-auto mt-16 w-full max-w-md px-4 text-center sm:px-6">
      <h1 className="text-3xl font-bold">Check your inbox</h1>
      <p className="mt-3 text-sm text-muted">
        We sent a confirmation link{email ? " to " : ""}
        {email ? <strong className="font-semibold text-ink">{email}</strong> : ""}. You need to open it and confirm
        before you can use your account &mdash; until then, logging in won&rsquo;t work.
      </p>
      <p className="mt-2 text-sm text-muted">Not there? Have a look in your spam folder.</p>

      {mode === "signup" && email ? (
        <form {...resendForm} className="mt-6">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-hairline px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send it again"}
          </button>
          {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}
          {state.sent ? <p role="status" className="mt-3 text-sm text-accent">Sent again — it can take a minute to arrive.</p> : null}
        </form>
      ) : null}

      <p className="mt-6 text-sm">
        <Link href="/login" className="text-accent underline">Back to log in</Link>
        {mode === "signup" ? (
          <>
            <span className="mx-2 text-muted">&middot;</span>
            <Link href="/signup" className="text-accent underline">Wrong address?</Link>
          </>
        ) : null}
      </p>
    </div>
  );
}

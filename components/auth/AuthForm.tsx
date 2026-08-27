"use client";

import Link from "next/link";
import { resendConfirmationAction, verifyCodeAction, type AuthState } from "@/app/actions/auth";
import { CodeInput } from "@/components/auth/CodeInput";
import { useStickyForm } from "@/lib/hooks";
import { useRef } from "react";
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
    return <CheckInbox email={state.email ?? ""} mode={mode} throttled={state.throttled} />;
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

      {state.error ? (
        <div className="mt-3">
          <p role="alert" className="text-sm text-danger">{state.error}</p>
          {/* An address that already has an account is a dead end on this form —
              say so, and put both ways forward right next to the message. */}
          {state.taken ? (
            <p className="mt-1.5 text-sm">
              <Link href="/login" className="text-accent underline">Log in instead</Link>
              <span className="mx-2 text-muted">&middot;</span>
              <Link href="/forgot-password" className="text-accent underline">Forgot your password?</Link>
            </p>
          ) : null}
        </div>
      ) : null}

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
 * (Supabase allows one per minute), and offers a way out of each dead end —
 * a typo, a mail that hasn't landed, and an address that was confirmed long
 * ago. That last one is why "Already confirmed? Log in" is always on screen:
 * Supabase answers a resend for a confirmed address with a plain 200 and
 * sends nothing, so the screen can't tell that case apart, and showing the
 * way out to everyone keeps the form from becoming an account-existence
 * oracle.
 */
function CheckInbox({
  email,
  mode,
  throttled,
}: {
  email: string;
  mode: "login" | "signup";
  throttled?: boolean;
}) {
  const [state, resendForm, pending] = useStickyForm<AuthState>(resendConfirmationAction, {});
  const [codeState, codeForm, verifying] = useStickyForm<AuthState>(verifyCodeAction, {});
  const codeFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="mx-auto mt-16 w-full max-w-md px-4 text-center sm:px-6">
      <h1 className="text-3xl font-bold">Check your inbox</h1>
      <p className="mt-3 text-sm text-muted">
        We sent a 6-digit code{email ? " to " : ""}
        {email ? <strong className="font-semibold text-ink">{email}</strong> : ""}. Enter it below to finish creating
        your account &mdash; until then, logging in won&rsquo;t work.
      </p>
      {throttled ? (
        <p role="status" className="mt-2 text-sm text-muted">
          One went out to this address a moment ago, so we didn&rsquo;t send another. Give it a minute to land.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted">Not there? Have a look in your spam folder.</p>

      {mode === "signup" && email ? (
        <form {...codeForm} ref={codeFormRef} className="mt-6">
          <input type="hidden" name="email" value={email} />
          <CodeInput
            disabled={verifying}
            invalid={Boolean(codeState.error)}
            // Six digits is the whole form, so submit as soon as they're there
            // rather than making the member hunt for a button.
            onComplete={() => codeFormRef.current?.requestSubmit()}
          />
          {codeState.error ? (
            <p role="alert" className="mt-3 text-sm text-danger">{codeState.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={verifying}
            className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {verifying ? "Checking…" : "Confirm"}
          </button>
        </form>
      ) : null}

      {mode === "signup" && email ? (
        <form {...resendForm} className="mt-5">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-hairline px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send a new code"}
          </button>
          {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}
          {state.sent ? <p role="status" className="mt-3 text-sm text-accent">A new code is on its way.</p> : null}
        </form>
      ) : null}

      <p className="mt-6 text-sm">
        <Link href="/login" className="text-accent underline">Already confirmed? Log in</Link>
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

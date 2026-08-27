"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { resendConfirmationAction, verifyCodeAction, type AuthState } from "@/app/actions/auth";
import { CodeInput } from "@/components/auth/CodeInput";
import { useStickyForm } from "@/lib/hooks";
import { inputClass, labelClass } from "@/components/auth/fields";

/**
 * The confirmation screen reached from the e-mail ("closed the tab?") rather
 * than straight after signing up. Same six boxes; the address is asked for
 * only when the link didn't carry one, so the usual path is still code-only.
 */
export function VerifyForm({ email: initial }: { email: string }) {
  const [email, setEmail] = useState(initial);
  const [state, form, verifying] = useStickyForm<AuthState>(verifyCodeAction, {});
  const [resent, resendForm, resending] = useStickyForm<AuthState>(resendConfirmationAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="mx-auto mt-16 w-full max-w-md px-4 text-center sm:px-6">
      <h1 className="text-3xl font-bold">Enter your code</h1>
      <p className="mt-3 text-sm text-muted">
        {initial ? (
          <>
            We sent a 6-digit code to <strong className="font-semibold text-ink">{initial}</strong>. It&rsquo;s good for
            an hour.
          </>
        ) : (
          <>Type the address you signed up with and the 6-digit code we emailed you.</>
        )}
      </p>

      <form {...form} ref={formRef} className="mt-6">
        {initial ? (
          <input type="hidden" name="email" value={email} />
        ) : (
          <label className={`${labelClass} text-left`}>
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
        )}

        <div className={initial ? "" : "mt-5"}>
          <CodeInput
            disabled={verifying}
            invalid={Boolean(state.error)}
            onComplete={() => {
              if (email) formRef.current?.requestSubmit();
            }}
          />
        </div>

        {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}

        <button
          type="submit"
          disabled={verifying}
          className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {verifying ? "Checking…" : "Confirm"}
        </button>
      </form>

      {email ? (
        <form {...resendForm} className="mt-5">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={resending}
            className="rounded-full border border-hairline px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {resending ? "Sending…" : "Send a new code"}
          </button>
          {resent.error ? <p role="alert" className="mt-3 text-sm text-danger">{resent.error}</p> : null}
          {resent.sent ? <p role="status" className="mt-3 text-sm text-accent">A new code is on its way.</p> : null}
        </form>
      ) : null}

      <p className="mt-6 text-sm">
        <Link href="/login" className="text-accent underline">Already confirmed? Log in</Link>
        <span className="mx-2 text-muted">&middot;</span>
        <Link href="/signup" className="text-accent underline">Wrong address?</Link>
      </p>
    </div>
  );
}

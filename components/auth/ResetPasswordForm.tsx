"use client";

import type { AuthState } from "@/app/actions/auth";
import { useStickyForm } from "@/lib/hooks";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { formClass, inputClass, labelClass, submitClass } from "@/components/auth/fields";

export function ResetPasswordForm({
  action,
  email,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  email?: string;
}) {
  const [state, form, pending] = useStickyForm<AuthState>(action, {});

  return (
    <form {...form} className={formClass}>
      <h1 className="text-3xl font-bold">Set a new password</h1>
      <p className="mt-1 text-sm text-muted">
        {email ? <>For <span className="text-ink">{email}</span>. </> : null}At least 8 characters.
      </p>

      <label className={labelClass}>
        New password
        <PasswordInput name="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>
      <label className={labelClass}>
        Confirm password
        <PasswordInput name="confirm" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>

      {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}

      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}

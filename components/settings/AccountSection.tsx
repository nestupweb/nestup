"use client";

import { useState } from "react";
import { changeEmailAction, changePasswordAction, type AccountState } from "@/app/actions/auth";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Card } from "@/components/settings/Card";
import { useStickyForm } from "@/lib/hooks";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted";
const rowButton =
  "shrink-0 rounded-full border border-hairline px-4 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent";
const submit =
  "mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60";

/** One collapsed row: a label, its current value, and the button that opens the form. */
function Row({
  title,
  value,
  open,
  onToggle,
  children,
}: {
  title: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-hairline py-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">{value}</p>
        </div>
        <button type="button" onClick={onToggle} className={rowButton}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

/**
 * The account card: the address you sign in with and your password. Signing
 * out is not repeated here — the header's Log out button is always on screen.
 * Both changes stay collapsed until asked for, so the page reads as a summary
 * rather than a form.
 */
export function AccountSection({ email }: { email: string }) {
  const [openRow, setOpenRow] = useState<"email" | "password" | null>(null);
  const [emailState, emailForm, emailPending] = useStickyForm<AccountState>(changeEmailAction, {});
  // A finished password change has nothing more to say, so the row folds itself
  // away — done inside the action rather than in an effect, so there is no
  // second render pass to close it.
  const [pwState, pwForm, pwPending] = useStickyForm<AccountState>(async (prev, formData) => {
    const result = await changePasswordAction(prev, formData);
    if (result.done) setOpenRow(null);
    return result;
  }, {});

  return (
    <Card title="Account" hint="The address you sign in with, and your password.">
      <Row
        title="E-mail address"
        value={email}
        open={openRow === "email"}
        onToggle={() => setOpenRow((r) => (r === "email" ? null : "email"))}
      >
        <form {...emailForm}>
          <label className={label}>
            New e-mail address
            <input name="email" type="email" required maxLength={120} className={input} />
          </label>
          {emailState.error ? <p role="alert" className="mt-2 text-sm text-danger">{emailState.error}</p> : null}
          {emailState.sent ? (
            <p role="status" className="mt-2 text-sm text-accent">
              Check the new inbox for a confirmation link — your address changes once you click it.
            </p>
          ) : null}
          <button type="submit" disabled={emailPending} className={submit}>
            {emailPending ? "Sending…" : "Send confirmation link"}
          </button>
        </form>
      </Row>

      <Row
        title="Password"
        value="••••••••"
        open={openRow === "password"}
        onToggle={() => setOpenRow((r) => (r === "password" ? null : "password"))}
      >
        <form {...pwForm}>
          <label className={label}>
            Current password
            <PasswordInput name="current" autoComplete="current-password" required className={input} />
          </label>
          <label className={`${label} mt-3`}>
            New password
            <PasswordInput name="password" autoComplete="new-password" required minLength={8} className={input} />
          </label>
          <label className={`${label} mt-3`}>
            Repeat new password
            <PasswordInput name="confirm" autoComplete="new-password" required minLength={8} className={input} />
          </label>
          {pwState.error ? <p role="alert" className="mt-2 text-sm text-danger">{pwState.error}</p> : null}
          <button type="submit" disabled={pwPending} className={submit}>
            {pwPending ? "Saving…" : "Change password"}
          </button>
        </form>
      </Row>
    </Card>
  );
}

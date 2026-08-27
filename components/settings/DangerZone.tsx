"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction, type ToggleState } from "@/app/actions/settings";
import { Card } from "@/components/settings/Card";

/**
 * Closing the account. Irreversible, so the button only wakes up once the
 * member has typed their own address — a deliberate second action, not a
 * dialog they can dismiss by reflex.
 */
export function DangerZone({ email }: { email: string }) {
  const [typed, setTyped] = useState("");
  const [state, submit, pending] = useActionState<ToggleState, FormData>(deleteAccountAction, {});
  const armed = typed.trim().toLowerCase() === email.trim().toLowerCase();

  return (
    <Card title="Danger zone" tone="danger">
      <p className="text-sm leading-6 text-ink">
        Deleting your account removes your profile, your listing, the rooms you saved, your viewing history, and every
        conversation and message. <strong className="font-semibold">This cannot be undone.</strong>
      </p>
      <form action={submit} className="mt-4">
        <label htmlFor="confirm_email" className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Type your e-mail address to confirm
        </label>
        <input
          id="confirm_email"
          name="confirm_email"
          type="text"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={email}
          className="mt-1 w-full max-w-sm rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-danger"
        />
        {state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}
        <button
          type="submit"
          disabled={!armed || pending}
          className="mt-4 rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </Card>
  );
}

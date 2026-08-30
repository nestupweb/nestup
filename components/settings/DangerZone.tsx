"use client";

import { useState } from "react";
import { deleteAccountAction, type ToggleState } from "@/app/actions/settings";
import { Card } from "@/components/settings/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useStickyForm } from "@/lib/hooks";
import type { ListingHeir } from "@/lib/handover";

/**
 * Closing the account. Irreversible, so the button only wakes up once the
 * member has typed their own address — a deliberate second action, not a
 * dialog they can dismiss by reflex.
 *
 * A shared listing complicates the old sentence "this deletes your listing",
 * because since migration 0040 it doesn't (user request, 2026-08-29): a room
 * with confirmed roommates on it changes hands rather than disappearing out
 * from under the people living in it. So the copy says what will actually
 * happen, and when more than one roommate could take it, the delete button
 * opens a picker first. The database enforces the same rule; this is the part
 * that makes it a choice rather than an error.
 */
export function DangerZone({ email, heirs }: { email: string; heirs: ListingHeir[] }) {
  const [typed, setTyped] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [state, form, pending] = useStickyForm<ToggleState>(deleteAccountAction, {});
  const armed = typed.trim().toLowerCase() === email.trim().toLowerCase();

  const able = heirs.filter((h) => h.eligible);
  const blocked = heirs.filter((h) => !h.eligible);
  const listing = heirs[0]?.listing_title ?? "";
  const mustChoose = able.length > 1;
  const [heir, setHeir] = useState(() => (able.length === 1 ? able[0].resident_id : ""));

  return (
    <Card title="Delete account" tone="danger">
      <p className="text-sm leading-6 text-ink">
        Deleting your account removes your profile,{" "}
        {able.length > 0 ? "the rooms you saved" : "your listing, the rooms you saved"}, your viewing history, and every
        conversation and message. <strong className="font-semibold">This cannot be undone.</strong>
      </p>

      {able.length === 1 ? (
        <p className="mt-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-sm leading-6 text-ink">
          <strong className="font-semibold">{listing}</strong> stays where it is: {able[0].full_name} lives there too, so
          the room passes to them.
        </p>
      ) : null}

      {mustChoose ? (
        <p className="mt-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-sm leading-6 text-ink">
          <strong className="font-semibold">{listing}</strong> stays where it is — {able.length} of your roommates live
          there, so you&rsquo;ll be asked which of them the room passes to.
        </p>
      ) : null}

      {blocked.length > 0 && able.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-muted">
          {blocked.map((h) => h.full_name).join(", ")} {blocked.length === 1 ? "already has" : "already have"} a room of
          their own, so the listing can&rsquo;t pass to {blocked.length === 1 ? "them" : "any of them"}.
        </p>
      ) : null}

      <form {...form} className="mt-4">
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
        {/* Whoever inherits — chosen in the picker, or settled already. */}
        <input type="hidden" name="heir" value={heir} />
        {state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}

        {mustChoose ? (
          <button
            type="button"
            disabled={!armed || pending}
            onClick={() => setChoosing(true)}
            className="mt-4 rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Delete my account
          </button>
        ) : (
          <button
            type="submit"
            disabled={!armed || pending}
            className="mt-4 rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {pending ? "Deleting…" : "Delete my account"}
          </button>
        )}

        {choosing ? (
          <HeirPicker
            heirs={able}
            listing={listing}
            chosen={heir}
            onChoose={setHeir}
            onClose={() => setChoosing(false)}
            pending={pending}
          />
        ) : null}
      </form>
    </Card>
  );
}

/**
 * "Who gets the room?" — the last thing between the member and the deletion.
 *
 * Rendered inside the same form as the hidden `heir` input, so confirming is an
 * ordinary submit: no second action, nothing to keep in sync, and the answer
 * cannot be lost between the picking and the deleting.
 */
function HeirPicker({
  heirs,
  listing,
  chosen,
  onChoose,
  onClose,
  pending,
}: {
  heirs: ListingHeir[];
  listing: string;
  chosen: string;
  onChoose: (id: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        data-cursor="arrow"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="heir-title"
        className="relative w-full max-w-md rounded-t-[28px] border border-hairline bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5)] sm:rounded-[28px] sm:p-6"
      >
        <h2 id="heir-title" className="text-lg font-bold text-ink">
          Who takes over {listing || "the listing"}?
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          Your account is about to close, and the room can&rsquo;t be left without an owner. Whoever you pick becomes its
          owner: they can edit it, pause it and take it down.
        </p>

        <ul className="mt-4 space-y-2">
          {heirs.map((h) => (
            <li key={h.resident_id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  chosen === h.resident_id ? "border-accent bg-accent/5" : "border-hairline"
                }`}
              >
                <input
                  type="radio"
                  name="heir_choice"
                  value={h.resident_id}
                  checked={chosen === h.resident_id}
                  onChange={() => onChoose(h.resident_id)}
                />
                <Avatar url={h.avatar_url} name={h.full_name} size={10} />
                <span className="text-sm font-semibold text-ink">{h.full_name}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-muted">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!chosen || pending}
            className="rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {pending ? "Deleting…" : "Hand over & delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

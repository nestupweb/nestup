"use client";

import { useState, useTransition } from "react";
import {
  listingChatCountAction,
  markListingTakenAction,
  reopenListingAction,
  type TakenState,
} from "@/app/actions/listing-status";
import { defaultTakenMessage, takenOnLabel, tellCountLabel } from "@/lib/listing-taken";
import { useStickyForm } from "@/lib/hooks";

const BUTTON =
  "mt-4 inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent";
const PRIMARY =
  "rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60";
const QUIET = "rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-ink";

/**
 * Closing a deal, from the owner's own listing. Deliberately not the same
 * control as "My listing is live" in Settings: pausing is quiet and reversible,
 * this takes the room down *and* tells every member the owner is talking to,
 * in the chat they were already using. The owner sees who will hear it and can
 * rewrite the message before it goes.
 */
export function MarkTaken({
  listingId,
  title,
  takenAt,
}: {
  listingId: string;
  title: string;
  takenAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Counted when the panel opens rather than on every profile render: it is
  // only ever read here, and MyListing renders inside a client component.
  const [chatCount, setChatCount] = useState<number | null>(null);
  const [, startCount] = useTransition();
  const [state, form, pending] = useStickyForm<TakenState>(markListingTakenAction, {});
  const [reopening, startReopen] = useTransition();
  const [reopenError, setReopenError] = useState("");

  if (takenAt) {
    return (
      <div className="mt-4">
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">Taken.</span> {takenOnLabel(takenAt)} — the room is out of Listings
          and Swipe, and everyone you were chatting with was told.
        </p>
        <button
          type="button"
          disabled={reopening}
          onClick={() =>
            startReopen(async () => {
              const result = await reopenListingAction(listingId);
              setReopenError(result.error ?? "");
            })
          }
          className={BUTTON}
        >
          {reopening ? "Putting it back…" : "Put the room back up"}
        </button>
        {reopenError ? <p role="alert" className="mt-2 text-sm text-danger">{reopenError}</p> : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          startCount(async () => setChatCount((await listingChatCountAction(listingId)).count));
        }}
        className={BUTTON}
      >
        The room is taken
      </button>
    );
  }

  return (
    <form {...form} className="mt-4 rounded-2xl border border-hairline p-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <h3 className="text-sm font-semibold text-ink">Tell everyone the room is taken</h3>
      <p className="mt-1 text-sm text-muted">
        This takes the room out of Listings and Swipe, and sends one message to everyone you are chatting with about it.
        You can put it back up later.
      </p>
      <p className="mt-2 text-sm text-muted">
        {chatCount === null ? "Counting who is waiting on it…" : tellCountLabel(chatCount)}
      </p>

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        The message they will read
        <textarea
          name="message"
          rows={3}
          defaultValue={defaultTakenMessage(title)}
          className="mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm normal-case tracking-normal text-ink outline-none focus:border-accent"
        />
      </label>

      {state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}
      {state.told !== undefined ? (
        <p role="status" className="mt-2 text-sm text-accent">
          {state.told === 0
            ? "The room is closed. There was nobody to tell."
            : `The room is closed and ${state.told === 1 ? "1 person was" : `${state.told} people were`} told.`}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Sending…" : chatCount === 0 ? "Close the room" : "Close the room & tell everyone"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={QUIET}>
          Cancel
        </button>
      </div>
    </form>
  );
}

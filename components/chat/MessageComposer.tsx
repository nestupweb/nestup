"use client";

import { useActionState } from "react";
import { sendMessageAction, type SendMessageState } from "@/app/actions/chat";

export function MessageComposer({
  conversationId,
  listingId,
}: {
  conversationId: string;
  listingId: string;
}) {
  const [state, formAction, pending] = useActionState<SendMessageState, FormData>(
    sendMessageAction,
    {}
  );

  return (
    // key: a new sentNonce after a successful send remounts the form, clearing the
    // textarea. On error the nonce is unchanged and defaultValue echoes the draft back
    // (React 19 resets uncontrolled fields after every action).
    <form action={formAction} key={state.sentNonce ?? 0} className="mt-5">
      <input type="hidden" name="conversation_id" value={conversationId} />
      <input type="hidden" name="listing_id" value={listingId} />
      <label htmlFor="chat-message" className="sr-only">Message</label>
      <textarea
        id="chat-message"
        name="content"
        required
        maxLength={2000}
        rows={3}
        placeholder="Write a message…"
        defaultValue={state.error ? state.content ?? "" : ""}
        className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
      />
      {state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-accent-contrast disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

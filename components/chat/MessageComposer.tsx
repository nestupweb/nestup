"use client";

import { useActionState, useRef, type KeyboardEvent } from "react";
import { sendMessageAction, type SendMessageState } from "@/app/actions/chat";

export function MessageComposer({
  conversationId,
  onSchedule,
}: {
  conversationId: string;
  onSchedule?: () => void;
}) {
  const [state, formAction, pending] = useActionState<SendMessageState, FormData>(
    sendMessageAction,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline — messenger convention.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.currentTarget.value.trim()) formRef.current?.requestSubmit();
    }
  }

  return (
    // key: a new sentNonce after a successful send remounts the form, clearing the
    // textarea. On error the nonce is unchanged and defaultValue echoes the draft back
    // (React 19 resets uncontrolled fields after every action).
    <form ref={formRef} action={formAction} key={state.sentNonce ?? 0}>
      <input type="hidden" name="conversation_id" value={conversationId} />
      <div className="flex items-end gap-2">
        {onSchedule ? (
          <button
            type="button"
            onClick={onSchedule}
            aria-label="Schedule a viewing"
            title="Schedule a viewing"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <CalendarIcon />
          </button>
        ) : null}
        <label htmlFor="chat-message" className="sr-only">Message</label>
        <textarea
          id="chat-message"
          name="content"
          required
          maxLength={2000}
          rows={1}
          autoComplete="off"
          placeholder="Write a message…"
          onKeyDown={onKeyDown}
          defaultValue={state.error ? state.content ?? "" : ""}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-3xl border border-hairline bg-surface px-4 py-3 text-[16px] leading-5 text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label={pending ? "Sending" : "Send"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast transition-opacity disabled:opacity-60"
        >
          <SendIcon />
        </button>
      </div>
      {state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 translate-x-px" aria-hidden="true">
      <path d="M4 12 20 4l-4 16-4-7-8-1Z" />
      <path d="m12 13 8-9" />
    </svg>
  );
}

export function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8.5 14.5h2M13.5 14.5h2" />
    </svg>
  );
}

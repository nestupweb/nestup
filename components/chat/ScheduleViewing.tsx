"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { disconnectGoogleAction, proposeViewingAction, type ViewingFormState } from "@/app/actions/viewing";
import { VIEWING_DURATIONS } from "@/lib/calendar";
import type { ConversationSummary } from "@/lib/types";

export interface GoogleState {
  configured: boolean;
  connected: boolean;
  email: string;
}

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[10px] font-semibold uppercase tracking-widest text-muted";

function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TIMES: string[] = [];
for (let h = 8; h <= 21; h++) for (const m of ["00", "30"]) TIMES.push(`${String(h).padStart(2, "0")}:${m}`);

/** Bottom sheet (phone) / dialog (desktop) that proposes a viewing in this chat. */
export function ScheduleViewing({
  conversation,
  google,
  onClose,
}: {
  conversation: ConversationSummary;
  google: GoogleState;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<ViewingFormState, FormData>(
    proposeViewingAction,
    {}
  );
  const [, startTransition] = useTransition();

  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => new Date(today.getTime() + 86_400_000), [today]);
  const [date, setDate] = useState(localDate(tomorrow));
  const [time, setTime] = useState("18:00");
  const startsAt = useMemo(() => {
    const d = new Date(`${date}T${time}:00`);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }, [date, time]);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem";

  useEffect(() => {
    if (state.done && !state.warning) onClose();
  }, [state.done, state.warning, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const other = conversation.other_name ?? "your contact";
  const where = [conversation.listing_address, conversation.listing_city].filter(Boolean).join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />
      <form
        action={formAction}
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewing-title"
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-hairline bg-paper p-5 shadow-2xl sm:rounded-3xl"
      >
        <input type="hidden" name="conversation_id" value={conversation.id} />
        <input type="hidden" name="starts_at" value={startsAt} />
        <input type="hidden" name="time_zone" value={timeZone} />

        <h2 id="viewing-title" className="font-serif text-2xl font-semibold">Schedule a viewing</h2>
        <p className="mt-1 text-sm text-muted">
          {conversation.listing_title}
          {where ? ` · ${where}` : ""}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className={label}>
            Date
            <input
              type="date"
              required
              min={localDate(today)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={input}
            />
          </label>
          <label className={label}>
            Time
            <select value={time} onChange={(e) => setTime(e.target.value)} className={input}>
              {TIMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={label}>
            Duration
            <select name="duration" defaultValue="45" className={input}>
              {VIEWING_DURATIONS.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Note (optional)
            <input name="note" maxLength={300} placeholder="Ring twice" className={input} />
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-hairline bg-surface p-3.5 text-sm">
          {!google.configured ? (
            <p className="text-muted">
              Google Calendar sync isn&rsquo;t set up on this server yet. The viewing is saved in
              the chat and each of you gets an &ldquo;Add to Google Calendar&rdquo; link.
            </p>
          ) : google.connected ? (
            <div className="flex items-start justify-between gap-3">
              <p>
                <span className="font-medium text-accent">✓ Google Calendar connected</span>
                <span className="block text-xs text-muted">
                  {google.email || "Your account"} · the event is created for you and {other} gets an invite.
                </span>
              </p>
              <button
                type="button"
                onClick={() => startTransition(() => { void disconnectGoogleAction(conversation.id); })}
                className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-ink"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted">Connect Google Calendar to create the event and invite {other}.</p>
              <a
                href={`/api/google/connect?return=${encodeURIComponent(`/chat/${conversation.id}`)}`}
                className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
              >
                Connect
              </a>
            </div>
          )}
        </div>

        {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}
        {state.warning ? (
          <p role="status" className="mt-3 text-sm text-danger">
            {state.warning}{" "}
            <button type="button" onClick={onClose} className="underline underline-offset-2">Close</button>
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-hairline py-2.5 text-sm font-semibold text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !startsAt}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-contrast disabled:opacity-60"
          >
            {pending ? "Proposing…" : "Propose viewing"}
          </button>
        </div>
      </form>
    </div>
  );
}

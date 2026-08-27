"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { disconnectGoogleAction, proposeViewingAction, type ViewingFormState } from "@/app/actions/viewing";
import { DatePicker, parseISODate, todayISO, toISODate } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { VIEWING_DURATIONS } from "@/lib/calendar";
import { allowedWeekdays, describeSlots, normalizeSlots, startTimes } from "@/lib/availability";
import { useStickyForm } from "@/lib/hooks";
import type { ConversationSummary } from "@/lib/types";

export interface GoogleState {
  configured: boolean;
  connected: boolean;
  email: string;
}

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[11px] font-semibold uppercase tracking-widest text-muted";

function addDays(iso: string, n: number): string {
  const p = parseISODate(iso)!;
  const d = new Date(p.y, p.m - 1, p.d + n);
  return toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Bottom sheet (phone) / dialog (desktop) that requests a viewing in this
 * chat. Seekers can only pick days and times inside the host's viewing hours;
 * the request then waits for the other party's approval.
 */
export function ScheduleViewing({
  conversation,
  meId,
  google,
  onClose,
}: {
  conversation: ConversationSummary;
  meId: string;
  google: GoogleState;
  onClose: () => void;
}) {
  const [state, form, pending] = useStickyForm<ViewingFormState>(proposeViewingAction, {});
  const [, startTransition] = useTransition();

  const iAmSeeker = conversation.seeker_id === meId;
  // Hosts know their own hours; seekers are held to them.
  const slots = useMemo(
    () => (iAmSeeker ? normalizeSlots(conversation.listing_viewing_slots) : []),
    [iAmSeeker, conversation.listing_viewing_slots]
  );
  const weekdays = useMemo(() => allowedWeekdays(slots), [slots]);
  const hours = useMemo(() => describeSlots(slots), [slots]);

  const today = useMemo(() => todayISO(), []);
  const maxDate = useMemo(() => addDays(today, 90), [today]);
  const [duration, setDuration] = useState<number>(45);
  // First selectable day: tomorrow, or the next day with viewing hours.
  const firstDay = useMemo(() => {
    let d = addDays(today, 1);
    for (let i = 0; i < 14; i++) {
      const p = parseISODate(d)!;
      const wd = new Date(p.y, p.m - 1, p.d).getDay();
      if (!weekdays || weekdays.includes(wd)) return d;
      d = addDays(d, 1);
    }
    return d;
  }, [today, weekdays]);
  const [date, setDate] = useState(firstDay);
  const weekday = useMemo(() => {
    const p = parseISODate(date);
    return p ? new Date(p.y, p.m - 1, p.d).getDay() : 0;
  }, [date]);
  const times = useMemo(() => startTimes(slots, weekday, duration), [slots, weekday, duration]);
  const [picked, setTime] = useState<string>("18:00");
  // The chosen time, or the nearest valid one as the day / duration changes.
  const time = times.includes(picked) ? picked : times.includes("18:00") ? "18:00" : times[0] ?? "";

  const startsAt = useMemo(() => {
    if (!date || !time) return "";
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
        {...form}
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewing-title"
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-hairline bg-paper p-5 shadow-2xl sm:rounded-3xl"
      >
        <input type="hidden" name="conversation_id" value={conversation.id} />
        <input type="hidden" name="starts_at" value={startsAt} />
        <input type="hidden" name="time_zone" value={timeZone} />
        <input type="hidden" name="duration" value={duration} />

        <h2 id="viewing-title" className="text-2xl font-bold">Request a viewing</h2>
        <p className="mt-1 text-sm text-muted">
          {conversation.listing_title}
          {where ? ` · ${where}` : ""}
        </p>
        {hours.length > 0 ? (
          <p className="mt-2 text-xs text-muted">
            <span className="font-bold uppercase tracking-wider text-accent">Viewing hours</span>{" "}
            {hours.join(" · ")}
          </p>
        ) : null}

        <div className="mt-4 rounded-2xl border border-hairline bg-surface p-3">
          <DatePicker inline value={date} onChange={setDate} min={addDays(today, 1)} max={maxDate} allowedWeekdays={weekdays} />
        </div>

        <div className="mt-4">
          <span className={label}>Time</span>
          {times.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No viewing hours on this day — pick another date.</p>
          ) : (
            <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto" role="radiogroup" aria-label="Time">
              {times.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={t === time}
                  onClick={() => setTime(t)}
                  className={`rounded-full border px-3 py-1.5 text-sm tabular-nums transition-colors ${
                    t === time
                      ? "border-accent bg-accent text-accent-contrast"
                      : "border-hairline bg-surface text-ink hover:border-accent hover:text-accent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={label}>
            Duration
            <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {VIEWING_DURATIONS.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </Select>
          </label>
          <label className={label}>
            Note (optional)
            <input name="note" maxLength={300} placeholder="Ring twice" className={input} />
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-hairline bg-surface p-3.5 text-sm">
          {!google.configured ? (
            <p className="text-muted">
              Once {other} approves, each of you gets an &ldquo;Add to Google Calendar&rdquo; link in the chat.
            </p>
          ) : google.connected ? (
            <div className="flex items-start justify-between gap-3">
              <p>
                <span className="font-medium text-accent">✓ Google Calendar connected</span>
                <span className="block text-xs text-muted">
                  {google.email || "Your account"} · once the viewing is approved, the event is created and {other} gets an invite.
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
              <p className="text-muted">Connect Google Calendar to send {other} an invite once the viewing is approved.</p>
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
            {pending ? "Sending…" : "Request viewing"}
          </button>
        </div>
      </form>
    </div>
  );
}

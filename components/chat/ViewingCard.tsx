"use client";

import { useState, useTransition } from "react";
import { respondViewingAction, syncViewingToGoogleAction } from "@/app/actions/viewing";
import { CalendarIcon } from "@/components/chat/MessageComposer";
import type { GoogleState } from "@/components/chat/ScheduleViewing";
import { describeViewing, googleCalendarTemplateUrl } from "@/lib/calendar";
import { viewingLabel } from "@/lib/chat-format";
import type { ConversationSummary, Viewing, ViewingStatus } from "@/lib/types";

const STATUS: Record<ViewingStatus, { label: string; tone: string }> = {
  proposed: { label: "Pending approval", tone: "bg-hairline text-ink" },
  confirmed: { label: "Approved", tone: "bg-accent/15 text-accent" },
  declined: { label: "Declined", tone: "bg-danger/10 text-danger" },
  cancelled: { label: "Cancelled", tone: "bg-danger/10 text-danger" },
};

const btn = "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60";

/**
 * A viewing request in the timeline. It stays "Pending approval" until the
 * other party approves; only then do the calendar actions appear.
 */
export function ViewingCard({
  viewing,
  meId,
  conversation,
  google,
}: {
  viewing: Viewing;
  meId: string;
  conversation: ConversationSummary;
  google?: GoogleState;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const mine = viewing.proposed_by === meId;
  const other = conversation.other_name ?? "Your contact";
  const { date, time } = viewingLabel(viewing.starts_at, viewing.ends_at);
  const copy = describeViewing(
    {
      title: conversation.listing_title,
      address: conversation.listing_address,
      city: conversation.listing_city,
      rent: conversation.listing_rent,
    },
    other,
    viewing.note
  );
  const addUrl = googleCalendarTemplateUrl({
    title: copy.summary,
    details: copy.description,
    location: copy.location,
    start: new Date(viewing.starts_at),
    end: new Date(viewing.ends_at),
  });
  const status = STATUS[viewing.status];
  const approved = viewing.status === "confirmed";
  const open = viewing.status === "proposed" || approved;

  const respond = (next: ViewingStatus) =>
    startTransition(async () => {
      const res = await respondViewingAction(viewing.id, next, viewing.conversation_id);
      setNotice(res.ok ? res.warning ?? null : res.error ?? "Could not update the viewing.");
    });
  const sendInvite = () =>
    startTransition(async () => {
      const res = await syncViewingToGoogleAction(
        viewing.id,
        viewing.conversation_id,
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem"
      );
      setNotice(res.ok ? null : res.error ?? "Google Calendar did not accept the event.");
    });

  return (
    <div className="mx-auto my-2 w-full max-w-sm rounded-2xl border border-hairline bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <CalendarIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
            {mine ? "You requested a viewing" : `${other} requested a viewing`}
          </p>
          <p className="mt-1 text-lg font-semibold leading-tight">{date}</p>
          <p className="text-sm text-muted">
            {time}
            {copy.location ? ` · ${copy.location}` : ""}
          </p>
          {viewing.note ? <p className="mt-2 text-sm">&ldquo;{viewing.note}&rdquo;</p> : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${status.tone}`}>
          {status.label}
        </span>
        {viewing.status === "proposed" && !mine ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("confirmed")}
              className={`${btn} bg-accent text-accent-contrast`}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("declined")}
              className={`${btn} border border-hairline text-ink hover:border-danger hover:text-danger`}
            >
              Decline
            </button>
          </>
        ) : null}
        {open && (mine || approved) ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => respond("cancelled")}
            className={`${btn} border border-hairline text-muted hover:border-danger hover:text-danger`}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {viewing.status === "proposed" ? (
        <p className="mt-3 border-t border-hairline pt-3 text-xs text-muted">
          {mine
            ? `Once ${other} approves, you can both add it to your calendars.`
            : "Approve to confirm the time — it can be added to your calendars right after."}
        </p>
      ) : null}

      {approved ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-hairline pt-3 text-xs text-muted">
          {viewing.google_event_link ? (
            <span>
              Invite sent via Google Calendar ·{" "}
              <a href={viewing.google_event_link} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                Open event ↗
              </a>
            </span>
          ) : (
            <>
              <a href={addUrl} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                Add to Google Calendar ↗
              </a>
              {google?.connected ? (
                <button type="button" disabled={pending} onClick={sendInvite} className="text-accent underline underline-offset-2 disabled:opacity-60">
                  Send invite to {other}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {notice ? <p role="status" className="mt-2 text-xs text-danger">{notice}</p> : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarIcon } from "@/components/chat/MessageComposer";
import { Avatar } from "@/components/ui/Avatar";
import { describeViewing, googleCalendarTemplateUrl } from "@/lib/calendar";
import { viewingLabel } from "@/lib/chat-format";
import type { ConversationSummary, Viewing } from "@/lib/types";

/** Everyone at the viewing, from the viewer's side of the table. */
export function viewingParticipants(
  conversation: ConversationSummary,
  meId: string
): { name: string; avatar: string | null; me: boolean }[] {
  // A seeker meets the whole household; the household meets the seeker.
  const household = conversation.seeker_id === meId ? conversation.household ?? [] : [];
  const others =
    household.length > 0
      ? household.map((h) => ({ name: h.full_name, avatar: h.avatar_url, me: false }))
      : [{ name: conversation.other_name ?? "NestUp member", avatar: conversation.other_avatar, me: false }];
  return [{ name: "You", avatar: null, me: true }, ...others];
}

/** Header chip shown while a confirmed viewing is still ahead; opens the details. */
export function ViewingScheduledChip({
  viewing,
  conversation,
  meId,
}: {
  viewing: Viewing;
  conversation: ConversationSummary;
  meId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-2 text-[12px] font-semibold uppercase tracking-wider text-accent transition-colors hover:border-accent hover:bg-accent/15"
      >
        <CalendarIcon className="h-4 w-4" />
        Viewing scheduled
      </button>
      {open ? <ViewingDetails viewing={viewing} conversation={conversation} meId={meId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const row = "grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-3";
const key = "text-[11px] font-semibold uppercase tracking-widest text-muted";

/** Every detail of one confirmed viewing: when, where, with whom, and the note. */
export function ViewingDetails({
  viewing,
  conversation,
  meId,
  onClose,
}: {
  viewing: Viewing;
  conversation: ConversationSummary;
  meId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const start = new Date(viewing.starts_at);
  const longDate = start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const { time } = viewingLabel(viewing.starts_at, viewing.ends_at);
  const where = [conversation.listing_address, conversation.listing_city].filter(Boolean).join(", ");
  const people = viewingParticipants(conversation, meId);
  const withName = people.find((p) => !p.me)?.name ?? "your contact";
  const copy = describeViewing(
    { title: conversation.listing_title, address: conversation.listing_address, city: conversation.listing_city, rent: conversation.listing_rent },
    withName,
    viewing.note
  );
  const addUrl = googleCalendarTemplateUrl({
    title: copy.summary,
    details: copy.description,
    location: copy.location,
    start,
    end: new Date(viewing.ends_at),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewing-details-title"
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-hairline bg-paper p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <CalendarIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className={key}>Viewing scheduled</p>
            <h2 id="viewing-details-title" className="mt-0.5 text-2xl font-semibold leading-tight">{longDate}</h2>
            <p className="text-sm text-muted">{time}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-hairline/50 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <dl className="mt-4 divide-y divide-hairline border-y border-hairline">
          <div className={row}>
            <dt className={key}>Date</dt>
            <dd className="text-sm text-ink">{longDate}</dd>
          </div>
          <div className={row}>
            <dt className={key}>Time</dt>
            <dd className="text-sm text-ink">{time}</dd>
          </div>
          <div className={row}>
            <dt className={key}>Property</dt>
            <dd className="min-w-0 text-sm text-ink">
              <Link href={`/browse/${conversation.listing_id}`} className="font-semibold underline-offset-2 hover:underline">
                {conversation.listing_title}
              </Link>
              {where ? <span className="block text-muted">{where}</span> : null}
              <span className="block text-muted">₪{conversation.listing_rent.toLocaleString()} / month</span>
            </dd>
          </div>
          <div className={row}>
            <dt className={key}>Participants</dt>
            <dd>
              <ul className="flex flex-col gap-1.5">
                {people.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-center gap-2 text-sm text-ink">
                    <Avatar url={p.avatar} name={p.name} size={10} className="h-7! w-7!" />
                    <span className={p.me ? "font-medium" : ""}>{p.name}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div className={row}>
            <dt className={key}>Notes</dt>
            <dd className="text-sm text-ink">{viewing.note ? <span className="whitespace-pre-line">{viewing.note}</span> : <span className="text-muted">No notes</span>}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {viewing.google_event_link ? (
            <a href={viewing.google_event_link} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
              Open in Google Calendar ↗
            </a>
          ) : (
            <a href={addUrl} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
              Add to Google Calendar ↗
            </a>
          )}
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
            Confirmed by both
          </span>
        </div>
      </div>
    </div>
  );
}

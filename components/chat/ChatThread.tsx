"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { CalendarIcon, MessageComposer } from "@/components/chat/MessageComposer";
import { ScheduleViewing, type GoogleState } from "@/components/chat/ScheduleViewing";
import { ViewingCard } from "@/components/chat/ViewingCard";
import { groupByDay, householdLabel, timeLabel } from "@/lib/chat-format";
import type { ConversationSummary, Message, Viewing } from "@/lib/types";

type TimelineItem = ({ kind: "message" } & Message) | ({ kind: "viewing" } & Viewing);

const noopSubscribe = () => () => {};
/** False during SSR/hydration, true after — day labels depend on the viewer's clock. */
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const NOTICES: Record<string, string> = {
  connected: "Google Calendar connected — propose a viewing and the invite goes out automatically.",
  error: "Google Calendar could not be connected. Please try again.",
  unconfigured: "Google Calendar sync is not configured on this server.",
};

export function ChatThread({
  meId,
  conversation,
  messages,
  viewings,
  google,
  calendarNotice,
}: {
  meId: string;
  conversation: ConversationSummary;
  messages: Message[];
  viewings: Viewing[];
  google: GoogleState;
  calendarNotice?: string;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const [sheetOpen, setSheetOpen] = useState(calendarNotice === "connected");
  const [notice, setNotice] = useState(calendarNotice ? NOTICES[calendarNotice] : undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const timeline = useMemo<TimelineItem[]>(
    () =>
      [
        ...messages.map((m) => ({ kind: "message" as const, ...m })),
        ...viewings.map((v) => ({ kind: "viewing" as const, ...v })),
      ].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    [messages, viewings]
  );
  const groups = useMemo(() => (mounted ? groupByDay(timeline) : []), [timeline, mounted]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline.length, mounted]);

  // The page marked this thread read on the server; refresh so the inbox badge agrees.
  useEffect(() => {
    if (conversation.unread_count > 0) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iAmSeeker = conversation.seeker_id === meId;
  const household = conversation.household ?? [];
  const other = iAmSeeker
    ? householdLabel(household.map((h) => h.full_name), conversation.other_name ?? "NestUp member")
    : conversation.other_name ?? "NestUp member";
  const roleLine = iAmSeeker
    ? `${household.length > 1 ? "Host & roommates" : "Host"} · ${conversation.listing_title}`
    : `Interested in ${conversation.listing_title}`;
  // Several people can reply from the household side, so label their bubbles.
  const groupChat = household.length > 1;
  const nameFor = (senderId: string) =>
    household.find((h) => h.user_id === senderId)?.full_name.split(" ")[0] ??
    (senderId === conversation.seeker_id ? conversation.other_name?.split(" ")[0] : undefined);
  const where = [conversation.listing_address, conversation.listing_city].filter(Boolean).join(" · ");

  return (
    <>
      <header className="flex items-center gap-3 border-b border-hairline px-3 py-2.5 lg:px-5">
        <Link
          href="/chat"
          aria-label="Back to chats"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-hairline/50 lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <Avatar url={conversation.other_avatar} name={other} size={10} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold">{other}</h1>
          <p className="truncate text-xs text-muted">{roleLine}</p>
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="hidden items-center gap-2 rounded-full border border-hairline px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink transition-colors hover:border-accent hover:text-accent sm:flex"
        >
          <CalendarIcon className="h-4 w-4" />
          Schedule a viewing
        </button>
      </header>

      <Link
        href={`/browse/${conversation.listing_id}`}
        className="flex items-center gap-3 border-b border-hairline px-3 py-2.5 transition-colors hover:bg-hairline/30 lg:px-5"
      >
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-hairline">
          {conversation.listing_photo ? (
            <Image src={conversation.listing_photo} alt="" fill sizes="48px" className="object-cover" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{conversation.listing_title}</span>
          <span className="block truncate text-xs text-muted">{where}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-base font-semibold">₪{conversation.listing_rent.toLocaleString()}</span>
          <span className="block text-[10px] uppercase tracking-wider text-muted">per month</span>
        </span>
      </Link>

      {notice ? (
        <div role="status" className="flex items-center justify-between gap-3 border-b border-hairline bg-accent/10 px-4 py-2 text-xs text-ink lg:px-5">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss" className="text-muted hover:text-ink">✕</button>
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 lg:px-6">
        {!mounted ? null : groups.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xs rounded-2xl border border-hairline bg-surface px-6 py-8 text-center">
            <p className="text-xl font-semibold">Say hello</p>
            <p className="mt-1 text-sm text-muted">Ask about the room, the roommates, or the move-in date.</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-label={g.label} className="mb-4">
              <div className="flex justify-center">
                <span className="rounded-full border border-hairline bg-surface px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {g.label}
                </span>
              </div>
              <ol className="mt-3 flex flex-col gap-1.5">
                {g.items.map((item, i) => {
                  if (item.kind === "viewing") {
                    return (
                      <li key={`v-${item.id}`}>
                        <ViewingCard viewing={item} meId={meId} conversation={conversation} />
                      </li>
                    );
                  }
                  const prev = g.items[i - 1];
                  const grouped = prev?.kind === "message" && prev.sender_id === item.sender_id;
                  return (
                    <li key={item.id}>
                      <Bubble
                        mine={item.sender_id === meId}
                        grouped={grouped}
                        content={item.content}
                        at={item.created_at}
                        sender={groupChat && item.sender_id !== meId && !grouped ? nameFor(item.sender_id) : undefined}
                      />
                    </li>
                  );
                })}
              </ol>
            </section>
          ))
        )}
      </div>

      <div className="border-t border-hairline bg-paper px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-5">
        <MessageComposer conversationId={conversation.id} onSchedule={() => setSheetOpen(true)} />
      </div>

      {sheetOpen ? <ScheduleViewing conversation={conversation} google={google} onClose={closeSheet} /> : null}
    </>
  );
}

function Bubble({
  mine,
  grouped,
  content,
  at,
  sender,
}: {
  mine: boolean;
  grouped: boolean;
  content: string;
  at: string;
  sender?: string;
}) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      {sender ? <span className="mb-0.5 ml-3 text-[10px] font-semibold uppercase tracking-wider text-muted">{sender}</span> : null}
      <div
        className={`max-w-[78%] px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
          mine
            ? `rounded-2xl rounded-br-md bg-accent text-accent-contrast ${grouped ? "rounded-tr-md" : ""}`
            : `rounded-2xl rounded-bl-md border border-hairline bg-surface text-ink ${grouped ? "rounded-tl-md" : ""}`
        }`}
      >
        <p className="whitespace-pre-line break-words">{content}</p>
        <time dateTime={at} className={`mt-1 block text-right text-[10px] ${mine ? "text-accent-contrast/70" : "text-muted"}`}>
          {timeLabel(at)}
        </time>
      </div>
    </div>
  );
}

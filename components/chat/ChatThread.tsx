"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendMessageAction } from "@/app/actions/chat";
import { MessageComposer, type SendPayload } from "@/components/chat/MessageComposer";
import { ScheduleViewing, type GoogleState } from "@/components/chat/ScheduleViewing";
import { ViewingCard } from "@/components/chat/ViewingCard";
import { ViewingScheduledChip } from "@/components/chat/ViewingDetails";
import { groupByDay, householdLabel, timeLabel } from "@/lib/chat-format";
import {
  mergeMessages,
  settledClientIds,
  upcomingConfirmed,
  type OutboxMessage,
  type OutboxStatus,
  type TimelineMessage,
} from "@/lib/chat-outbox";
import { useMounted, useNow } from "@/lib/hooks";
import type { ConversationSummary, Message, Viewing } from "@/lib/types";

type TimelineItem = ({ kind: "message" } & TimelineMessage) | ({ kind: "viewing" } & Viewing);

const NOTICES: Record<string, string> = {
  connected: "Google Calendar connected — propose a viewing and the invite goes out automatically.",
  error: "Google Calendar could not be connected. Please try again.",
  unconfigured: "Google Calendar sync is not configured on this server.",
};

/** Accent ring on the chat thumbnail while a confirmed viewing is still ahead. */
export const VIEWING_RING = "outline-2 outline-offset-2 outline-accent";
/** The word under the ringed thumbnail, in the same accent. */
export const VIEWING_LABEL = "text-[11px] font-semibold leading-none text-accent";

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
  const now = useNow();
  const [sheetOpen, setSheetOpen] = useState(calendarNotice === "connected");
  const [notice, setNotice] = useState(calendarNotice ? NOTICES[calendarNotice] : undefined);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // --- optimistic sending -------------------------------------------------
  const patch = useCallback((clientId: string, changes: Partial<OutboxMessage>) => {
    setOutbox((list) => list.map((o) => (o.client_id === clientId ? { ...o, ...changes } : o)));
  }, []);

  const deliver = useCallback(
    async (entry: OutboxMessage) => {
      patch(entry.client_id, { status: "sending", error: undefined });
      try {
        const res = await sendMessageAction({
          conversationId: conversation.id,
          clientId: entry.client_id,
          content: entry.content,
          imagePath: entry.image_path,
        });
        if (res.ok) patch(entry.client_id, { status: "sent" });
        else patch(entry.client_id, { status: "failed", error: res.error });
      } catch {
        patch(entry.client_id, { status: "failed", error: "Not sent — check your connection." });
      }
    },
    [conversation.id, patch]
  );

  const send = useCallback(
    (payload: SendPayload) => {
      const clientId = crypto.randomUUID();
      const entry: OutboxMessage = {
        id: clientId,
        client_id: clientId,
        conversation_id: conversation.id,
        sender_id: meId,
        content: payload.content,
        image_path: payload.imagePath,
        image_url: payload.imagePreview ?? undefined,
        created_at: new Date().toISOString(),
        status: "sending",
      };
      setOutbox((list) => {
        // Optimistic copies the server already knows are hidden by mergeMessages;
        // retire them (and their blob previews) here, on the next send.
        const settled = new Set(settledClientIds(messages, list));
        for (const o of list) if (settled.has(o.client_id) && o.image_url?.startsWith("blob:")) URL.revokeObjectURL(o.image_url);
        return [...list.filter((o) => !settled.has(o.client_id)), entry];
      });
      void deliver(entry);
    },
    [conversation.id, meId, deliver, messages]
  );

  const retry = useCallback(
    (clientId: string) => {
      const entry = outbox.find((o) => o.client_id === clientId);
      if (entry) void deliver(entry);
    },
    [outbox, deliver]
  );

  const dismiss = useCallback((clientId: string) => {
    setOutbox((list) => {
      const gone = list.find((o) => o.client_id === clientId);
      if (gone?.image_url?.startsWith("blob:")) URL.revokeObjectURL(gone.image_url);
      return list.filter((o) => o.client_id !== clientId);
    });
  }, []);

  // --- timeline -----------------------------------------------------------
  const merged = useMemo(() => mergeMessages(messages, outbox), [messages, outbox]);
  const timeline = useMemo<TimelineItem[]>(
    () =>
      [
        ...merged.map((m) => ({ kind: "message" as const, ...m })),
        ...viewings.map((v) => ({ kind: "viewing" as const, ...v })),
      ].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    [merged, viewings]
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

  // Confirmed and still ahead — drives the header chip and the thumbnail ring.
  const nextViewing = useMemo(() => (now ? upcomingConfirmed(viewings, now)[0] ?? null : null), [viewings, now]);

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
        <span className="flex shrink-0 flex-col items-center gap-1.5">
          <Link
            href={`/browse/${conversation.listing_id}`}
            aria-label={conversation.listing_title}
            title={nextViewing ? "Viewing scheduled" : undefined}
            data-viewing-ring={nextViewing ? "true" : undefined}
            className={`relative h-11 w-11 overflow-hidden rounded-xl bg-hairline ${nextViewing ? VIEWING_RING : ""}`}
          >
            {conversation.listing_photo ? (
              <Image src={conversation.listing_photo} alt="" fill sizes="44px" className="object-cover" />
            ) : null}
          </Link>
          {nextViewing ? <span className={VIEWING_LABEL}>Scheduled</span> : null}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-semibold">{other}</h1>
          <p className="truncate text-xs text-muted">{roleLine}</p>
        </div>
        {nextViewing ? <ViewingScheduledChip viewing={nextViewing} conversation={conversation} meId={meId} /> : null}
      </header>

      <Link
        href={`/browse/${conversation.listing_id}`}
        className="flex items-center gap-3 border-b border-hairline px-3 py-2.5 transition-colors hover:bg-hairline/30 lg:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{conversation.listing_title}</span>
          <span className="block truncate text-xs text-muted">{where}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-base font-semibold">₪{conversation.listing_rent.toLocaleString()}</span>
          <span className="block text-[11px] uppercase tracking-wider text-muted">per month</span>
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
                <span className="rounded-full border border-hairline bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted">
                  {g.label}
                </span>
              </div>
              <ol className="mt-3 flex flex-col gap-1.5">
                {g.items.map((item, i) => {
                  if (item.kind === "viewing") {
                    return (
                      <li key={`v-${item.id}`}>
                        <ViewingCard viewing={item} meId={meId} conversation={conversation} google={google} />
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
                        image={item.image_url}
                        onOpenImage={setLightbox}
                        at={item.created_at}
                        sender={groupChat && item.sender_id !== meId && !grouped ? nameFor(item.sender_id) : undefined}
                        status={item.status}
                        error={item.error}
                        onRetry={item.status === "failed" ? () => retry(item.id) : undefined}
                        onDismiss={item.status === "failed" ? () => dismiss(item.id) : undefined}
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
        <MessageComposer conversationId={conversation.id} onSend={send} onSchedule={() => setSheetOpen(true)} />
      </div>

      {sheetOpen ? <ScheduleViewing conversation={conversation} meId={meId} google={google} onClose={closeSheet} /> : null}

      {lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4" role="dialog" aria-modal="true" aria-label="Photo">
          <button type="button" aria-label="Close" onClick={() => setLightbox(null)} className="absolute inset-0" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="relative max-h-[90dvh] max-w-full rounded-2xl object-contain shadow-2xl" />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close photo"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
          >
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}

function Bubble({
  mine,
  grouped,
  content,
  image,
  onOpenImage,
  at,
  sender,
  status,
  error,
  onRetry,
  onDismiss,
}: {
  mine: boolean;
  grouped: boolean;
  content: string;
  image?: string;
  onOpenImage: (url: string) => void;
  at: string;
  sender?: string;
  status?: OutboxStatus;
  error?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const failed = status === "failed";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      {sender ? <span className="mb-0.5 ml-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{sender}</span> : null}
      <div
        data-status={status}
        className={`max-w-[78%] text-[16px] leading-snug shadow-sm transition-opacity ${image ? "p-1.5" : "px-3.5 py-2"} ${
          mine
            ? `rounded-2xl rounded-br-md bg-accent text-accent-contrast ${grouped ? "rounded-tr-md" : ""}`
            : `rounded-2xl rounded-bl-md border border-hairline bg-surface text-ink ${grouped ? "rounded-tl-md" : ""}`
        } ${failed ? "opacity-60" : status === "sending" ? "opacity-85" : ""}`}
      >
        {image ? (
          <button type="button" onClick={() => onOpenImage(image)} aria-label="Open photo" className="block overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="max-h-72 w-auto max-w-full object-cover" />
          </button>
        ) : null}
        {content ? <p className={`whitespace-pre-line break-words ${image ? "px-2 pt-1.5" : ""}`}>{content}</p> : null}
        <time dateTime={at} className={`mt-1 block text-right text-[11px] ${image ? "px-2 pb-0.5" : ""} ${mine ? "text-accent-contrast/70" : "text-muted"}`}>
          {status === "sending" ? "Sending…" : timeLabel(at)}
        </time>
      </div>
      {failed ? (
        <p role="alert" className="mt-1 mr-1 text-[11px] text-danger">
          {error ?? "Not sent"} ·{" "}
          <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">Retry</button> ·{" "}
          <button type="button" onClick={onDismiss} className="underline underline-offset-2">Dismiss</button>
        </p>
      ) : null}
    </div>
  );
}

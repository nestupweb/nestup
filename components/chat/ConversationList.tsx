"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { householdLabel, previewTime } from "@/lib/chat-format";
import { isUpcoming } from "@/lib/chat-outbox";
import { useNow } from "@/lib/hooks";
import type { ConversationSummary } from "@/lib/types";

/** Accent ring on the chat thumbnail while a confirmed viewing is still ahead. */
const VIEWING_RING = "outline-2 outline-offset-2 outline-accent";

export function ConversationList({
  conversations,
  meId,
}: {
  conversations: ConversationSummary[];
  meId: string;
}) {
  const pathname = usePathname();
  // The SQL already filters to viewings that haven't ended; re-check on the client clock once known.
  const now = useNow();

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between px-4 pb-3 pt-5 sm:px-0 lg:px-5">
        <h1 className="text-3xl font-semibold lg:text-2xl">Chats</h1>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          {conversations.length} {conversations.length === 1 ? "conversation" : "conversations"}
        </span>
      </div>

      {conversations.length === 0 ? (
        <div className="mx-auto max-w-sm px-6 py-16 text-center">
          <p className="text-2xl font-semibold">No conversations yet</p>
          <p className="mt-2 text-sm text-muted">Like a room on Swipe or message the roommates from any listing to start one.</p>
          <Link
            href="/browse"
            className="mt-5 inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast"
          >
            Browse rooms
          </Link>
        </div>
      ) : (
        <ul role="list" className="divide-y divide-hairline">
          {conversations.map((c) => {
            const active = pathname === `/chat/${c.id}`;
            const unread = c.unread_count;
            const mine = c.last_sender_id === meId;
            const stamp = c.last_message_at ?? c.created_at;
            // Seekers chat with the whole household; the household sees the seeker.
            const title =
              c.seeker_id === meId
                ? householdLabel((c.household ?? []).map((h) => h.full_name), c.other_name ?? "NestUp member")
                : c.other_name ?? "NestUp member";
            const viewingAhead = now > 0 && isUpcoming(c.next_viewing_ends_at, now);
            return (
              <li key={c.id}>
                <Link
                  href={`/chat/${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex gap-3 px-4 py-3.5 transition-colors sm:px-2 lg:px-5 ${
                    active ? "bg-accent/10" : "hover:bg-hairline/40"
                  }`}
                >
                  <span
                    title={viewingAhead ? "Viewing scheduled" : undefined}
                    data-viewing-ring={viewingAhead ? "true" : undefined}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-hairline ${viewingAhead ? VIEWING_RING : ""}`}
                  >
                    {c.listing_photo ? (
                      <Image src={c.listing_photo} alt="" fill sizes="56px" className="object-cover" />
                    ) : null}
                    {viewingAhead ? <span className="sr-only">Viewing scheduled</span> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[16px] ${unread ? "font-semibold" : "font-medium"}`}>
                        {title}
                      </span>
                      <time
                        suppressHydrationWarning
                        dateTime={stamp}
                        className={`shrink-0 text-[12px] ${unread ? "font-semibold text-accent" : "text-muted"}`}
                      >
                        {previewTime(stamp)}
                      </time>
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {c.listing_title} · {c.listing_city}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${unread ? "font-medium text-ink" : "text-muted"}`}>
                        {c.last_message ? `${mine ? "You: " : ""}${c.last_message}` : "Say hello"}
                      </span>
                      {unread > 0 ? (
                        <span
                          aria-label={`${unread} unread`}
                          className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-bold leading-[1.15rem] text-accent-contrast"
                        >
                          {unread > 99 ? "99+" : unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

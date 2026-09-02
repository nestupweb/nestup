"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { syncChatAction } from "@/app/actions/chat";

/**
 * Live updates: any message/viewing change visible to this user (RLS-filtered
 * by Supabase Realtime) re-renders the inbox, thread, and unread badge.
 *
 * The session token has to be on the socket BEFORE the channel joins. A
 * channel that joins first is evaluated as anonymous by RLS, receives nothing,
 * and the client never re-sends the token once it arrives (seen on production:
 * the join frame carried no access_token and no event ever came through). So:
 * read the session, hand it to Realtime, and only then subscribe.
 *
 * `syncChatAction`, not `router.refresh()`. The inbox is a `use cache: private`
 * entry now, and a bare router refresh would re-render the route and be handed
 * back the very same cached list — the message would not appear until the
 * stale window ran out. The action drops `chatTag` for this member first and
 * then refreshes, which is the whole reason caching the inbox is safe. This is
 * also the only path that covers a message from the *other* side: no action of
 * this member's runs for it, so without this the socket event would have
 * nothing to invalidate.
 */
export function ChatRealtime() {
  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Coalesced: a burst of inserts (a message plus its viewing row) costs one
    // invalidation, not one per event.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // A failure here is not worth surfacing — the next event, or the
        // visibility handler, retries. Swallowing it keeps a dropped socket
        // frame from throwing inside an effect.
        void syncChatAction().catch(() => {});
      }, 150);
    };
    // Anything missed while the tab was hidden shows up as soon as it's back.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (disposed) return;
      const token = data.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (disposed) return;
      channel = supabase
        .channel("chat-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "viewings" }, refresh)
        .subscribe();
    })();

    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}

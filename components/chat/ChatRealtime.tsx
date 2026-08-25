"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Live updates: any message/viewing change visible to this user (RLS-filtered
 * by Supabase Realtime) re-renders the inbox, thread, and unread badge.
 *
 * The session token has to be on the socket BEFORE the channel joins. A
 * channel that joins first is evaluated as anonymous by RLS, receives nothing,
 * and the client never re-sends the token once it arrives (seen on production:
 * the join frame carried no access_token and no event ever came through). So:
 * read the session, hand it to Realtime, and only then subscribe.
 */
export function ChatRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150);
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
  }, [router]);

  return null;
}

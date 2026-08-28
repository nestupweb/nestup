"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps a shared room in step across its co-owners.
 *
 * Since 0033 every confirmed roommate edits, closes and re-opens the *same*
 * `listings` row, so there is no copy to reconcile — what is left is telling
 * the other co-owners, who may be looking at the page right now, that it
 * changed. Each managed room gets a binding on this one channel; anything that
 * touches it re-renders the server components, so the rent, the "Taken" badge
 * and a removal all land without a manual reload.
 *
 * One binding per room rather than a blanket `listings` subscription: the site
 * has hundreds of live rooms and a member cares about the one or two that are
 * theirs.
 *
 * The session token has to be on the socket BEFORE the channel joins, exactly
 * as `ChatRealtime` documents — a channel that joins first is evaluated as
 * anonymous by RLS and receives nothing, and the client never re-sends the
 * token afterwards.
 */
export function SharedListingSync({ listingIds }: { listingIds: string[] }) {
  const router = useRouter();
  // A primitive keeps the effect from re-running on every new array identity.
  const key = listingIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;

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

      let joining = supabase.channel("shared-listings");
      for (const id of ids) {
        joining = joining.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "listings", filter: `id=eq.${id}` },
          refresh
        );
      }
      channel = joining.subscribe();
    })();

    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [key, router]);

  return null;
}

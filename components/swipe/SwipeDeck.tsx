"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { recordSwipeAction } from "@/app/actions/swipe";
import { IntroSheet } from "@/components/swipe/IntroSheet";
import { SwipeCard } from "@/components/swipe/SwipeCard";
import type { DeckEntry } from "@/lib/swipe";
import type { Profile, SwipeDirection } from "@/lib/types";

/** Matches `.swipe-exit-*` in globals.css — the next room mounts once the exit finishes. */
const EXIT_MS = 360;

/**
 * One room at a time. The decision is persisted in the background while the
 * card animates out, so the next room appears without a round-trip. A like
 * first opens the "say hi" sheet over the card; the card slides away only
 * once the sheet is closed (sent or "Not now").
 */
export function SwipeDeck({ entries, seeker }: { entries: DeckEntry[]; seeker: Profile }) {
  const [queue, setQueue] = useState(entries);
  const [leaving, setLeaving] = useState<SwipeDirection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intro, setIntro] = useState<DeckEntry | null>(null); // "say hi" sheet after a like
  const timer = useRef<number | null>(null);

  /** Animate the current card out, then bring up the next room. */
  const leave = useCallback((direction: SwipeDirection) => {
    setLeaving(direction);
    timer.current = window.setTimeout(() => {
      setQueue((q) => q.slice(1));
      setLeaving(null);
      timer.current = null;
    }, EXIT_MS);
  }, []);
  const closeIntro = useCallback(() => {
    setIntro(null);
    leave("like");
  }, [leave]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const current = queue[0];
  const upcoming = queue[1];

  const decide = (direction: SwipeDirection) => {
    if (!current || leaving || intro) return;
    setError(null);
    recordSwipeAction(current.listing.id, direction)
      .then((r) => {
        if (!r.ok) setError("That one didn't save — check your connection and try the next room.");
      })
      .catch(() => setError("That one didn't save — check your connection and try the next room."));
    if (direction === "like") {
      setIntro(current); // the card waits underneath until the sheet closes
      return;
    }
    leave(direction);
  };

  if (!current) {
    return <EmptyDeck seenAny={entries.length > 0} />;
  }

  return (
    <div>
      <SwipeCard
        key={current.listing.id}
        entry={current}
        seeker={seeker}
        leaving={leaving}
        onDecide={decide}
      />
      {upcoming?.listing.photo_urls[0] ? (
        // Warm the cache for the next room's cover so the hand-off is instant.
        <div aria-hidden className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0">
          <Image src={upcoming.listing.photo_urls[0]} alt="" width={16} height={16} priority />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mx-4 mt-3 text-center text-sm text-danger sm:mx-0">
          {error}
        </p>
      ) : null}
      {intro ? <IntroSheet key={`intro-${intro.listing.id}`} entry={intro} onClose={closeIntro} /> : null}
    </div>
  );
}

function EmptyDeck({ seenAny }: { seenAny: boolean }) {
  return (
    <div className="mx-auto mt-24 max-w-sm px-6 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">Swipe</p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight">
        {seenAny ? "That's every strong match for now." : "No strong matches yet."}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Only rooms that score Good or better with your profile show up here. New high-scoring
        listings land the moment they&rsquo;re posted &mdash; until then, revisit the rooms you liked,
        or browse every listing.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link
          href="/profile?tab=liked"
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast"
        >
          Liked rooms
        </Link>
        <Link
          href="/browse"
          className="rounded-full border border-hairline px-5 py-2 text-sm font-semibold text-ink hover:border-accent"
        >
          Browse all
        </Link>
      </div>
    </div>
  );
}

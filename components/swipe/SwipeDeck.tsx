"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { recordDwellAction } from "@/app/actions/dwell";
import { recordSwipeAction } from "@/app/actions/swipe";
import { IntroSheet } from "@/components/swipe/IntroSheet";
import { SwipeCard } from "@/components/swipe/SwipeCard";
import { DWELL_FLOOR_MS, rankByAffinity, withReading, type InterestVector } from "@/lib/affinity";
import type { DeckEntry } from "@/lib/swipe";
import { useDwell } from "@/lib/use-dwell";
import type { Profile, SwipeDirection } from "@/lib/types";

/** Matches `.swipe-exit-*` in globals.css — the next room mounts once the exit finishes. */
const EXIT_MS = 360;

/**
 * One room at a time. The decision is persisted in the background while the
 * card animates out, so the next room appears without a round-trip. A like
 * first opens the "say hi" sheet over the card; the card slides away only
 * once the sheet is closed (sent or "Not now").
 */
export function SwipeDeck({
  entries,
  seeker,
  introTemplate = "",
  interest: initialInterest = {},
  events: initialEvents = 0,
}: {
  entries: DeckEntry[];
  seeker: Profile;
  /** The seeker's saved default hello (Profile › Swipe), "" for the built-in text. */
  introTemplate?: string;
  /** Taste learned from earlier visits; `{}` for a seeker with no history. */
  interest?: InterestVector;
  /** How many rooms that taste is built from. */
  events?: number;
}) {
  const [queue, setQueue] = useState(entries);
  const [leaving, setLeaving] = useState<SwipeDirection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intro, setIntro] = useState<DeckEntry | null>(null); // "say hi" sheet after a like
  const timer = useRef<number | null>(null);

  // Taste lives in refs, not state: it changes once per card and only ever
  // feeds the next `setQueue`, so re-rendering the card on every update would
  // be work for nothing.
  const interest = useRef<InterestVector>(initialInterest);
  const events = useRef(initialEvents);
  // Deliberate navigation on the current card, reset as each one is flushed.
  const photosSeen = useRef(0);
  const pagesSeen = useRef(0);
  const byId = useRef(new Map(entries.map((e) => [e.listing.id, e])));

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

  /**
   * One card's attention, banked. `useDwell` calls this as the deck advances,
   * so the reading belongs to the card that just left — never to the one now on
   * screen, which is why the listing id is passed back rather than read here.
   */
  const bankAttention = useCallback((listingId: string, activeMs: number) => {
    const photos = photosSeen.current;
    const pages = pagesSeen.current;
    photosSeen.current = 0;
    pagesSeen.current = 0;
    if (activeMs < DWELL_FLOOR_MS) return; // a glance is not evidence

    // Fire and forget: a lost reading costs a little ranking quality, and must
    // never interrupt swiping.
    void recordDwellAction(listingId, activeMs, photos, pages).catch(() => {});

    const entry = byId.current.get(listingId);
    if (!entry) return;
    interest.current = withReading(interest.current, entry.listing, {
      listing_id: listingId,
      dwell_ms: activeMs,
      photos_seen: photos,
      pages_seen: pages,
    });
    events.current += 1;
    // Re-rank what is still to come. `q[0]` is held out on purpose: the seeker
    // is looking at it, and swapping it underneath them would be a bug rather
    // than personalisation.
    setQueue((q) =>
      q.length > 1 ? [q[0], ...rankByAffinity(q.slice(1), interest.current, events.current)] : q
    );
  }, []);

  useDwell(current?.listing.id ?? null, bankAttention);

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
        onPhotoView={() => {
          photosSeen.current += 1;
        }}
        onPageView={() => {
          pagesSeen.current += 1;
        }}
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
      {intro ? <IntroSheet key={`intro-${intro.listing.id}`} entry={intro} template={introTemplate} onClose={closeIntro} /> : null}
    </div>
  );
}

function EmptyDeck({ seenAny }: { seenAny: boolean }) {
  return (
    <div className="mx-auto mt-24 max-w-sm px-6 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">Swipe</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight">
        {seenAny ? "That's every strong match for now." : "No strong matches yet."}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Only rooms in your preferred cities, inside your budget, that score Good or better with
        your profile show up here. New matching listings land the moment they&rsquo;re posted &mdash;
        until then, widen your cities or budget in Edit Profile, revisit the rooms you liked, or
        browse every listing.
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

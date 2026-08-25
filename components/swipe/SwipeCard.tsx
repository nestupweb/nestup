"use client";

import Image from "next/image";
import { useState } from "react";
import { NoPhoto } from "@/components/listings/NoPhoto";
import { SwipePanel } from "@/components/swipe/SwipePanel";
import { scoreLabel } from "@/lib/compatibility";
import type { DeckEntry } from "@/lib/swipe";
import type { Profile, SwipeDirection } from "@/lib/types";

const stageButton =
  "flex items-center justify-center rounded-full text-white backdrop-blur-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";

/**
 * A single room: full-bleed photo story on top (scores, arrows, like/reject),
 * three-page information panel below. Remounted per listing via `key`, so
 * photo and page positions reset naturally.
 */
export function SwipeCard({
  entry,
  seeker,
  leaving,
  onDecide,
}: {
  entry: DeckEntry;
  seeker: Profile;
  leaving: SwipeDirection | null;
  onDecide: (direction: SwipeDirection) => void;
}) {
  const { listing, lifestyle, social } = entry;
  const photos = listing.photo_urls;
  const count = photos.length;
  const [photo, setPhoto] = useState(0);
  const [page, setPage] = useState(0);

  const prevPhoto = () => setPhoto((i) => (i - 1 + count) % count);
  const nextPhoto = () => setPhoto((i) => (i + 1) % count);

  const motion =
    leaving === "like" ? "swipe-exit-like" : leaving === "skip" ? "swipe-exit-skip" : "swipe-enter";

  return (
    <article
      aria-label={listing.title}
      className={`${motion} overflow-hidden bg-surface shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)] sm:rounded-[28px] sm:border sm:border-hairline`}
    >
      {/* ===== Photo stage ===== */}
      <div
        role="group"
        aria-label={`Photos of ${listing.title}`}
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={(e) => {
          if (count < 2) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            prevPhoto();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            nextPhoto();
          }
        }}
        className="relative h-[62dvh] max-h-[760px] min-h-[440px] overflow-hidden bg-ink/90 outline-none"
      >
        {count === 0 ? (
          <NoPhoto />
        ) : (
          photos.map((src, i) => (
            <Image
              key={src}
              src={src}
              alt={i === photo ? `${listing.title} — photo ${i + 1} of ${count}` : ""}
              aria-hidden={i !== photo}
              fill
              priority={i === 0}
              sizes="(min-width: 640px) 672px, 100vw"
              className={`object-cover transition-opacity duration-500 ${i === photo ? "opacity-100" : "opacity-0"}`}
            />
          ))
        )}

        {/* Legibility scrims — never block the image itself. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-linear-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black/55 to-transparent" />

        {/* Photo position, story-style. */}
        {count > 1 ? (
          <div aria-hidden className="absolute inset-x-4 top-3 flex gap-1.5">
            {photos.map((src, i) => (
              <span
                key={src}
                className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
                  i === photo ? "bg-white" : "bg-white/35"
                }`}
              />
            ))}
          </div>
        ) : null}
        <p aria-live="polite" className="sr-only">
          Photo {photo + 1} of {count}
        </p>

        {/* Compatibility, top-left. */}
        <div className="absolute left-4 top-7 flex flex-col items-start gap-2">
          <ScorePill value={lifestyle} label="Lifestyle match" />
          <ScorePill value={social} label="Social match" />
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={prevPhoto}
              aria-label="Previous photo"
              className={`${stageButton} absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 border border-white/40 bg-black/25 hover:bg-black/50`}
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              aria-label="Next photo"
              className={`${stageButton} absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 border border-white/40 bg-black/25 hover:bg-black/50`}
            >
              <Chevron direction="right" />
            </button>
          </>
        ) : null}

        {/* Decisions, centred on the bottom edge. */}
        <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => onDecide("skip")}
            disabled={leaving !== null}
            aria-label="Not for me"
            className={`${stageButton} h-14 w-14 border border-white/70 bg-black/30 hover:bg-white hover:text-ink disabled:opacity-60`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
              <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDecide("like")}
            disabled={leaving !== null}
            aria-label="Like this room"
            className={`${stageButton} h-14 w-14 bg-accent text-accent-contrast shadow-[0_12px_30px_-8px_rgba(0,0,0,0.6)] hover:scale-105 disabled:opacity-60`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M12 20.5c-.35 0-.7-.12-.98-.36C7.1 16.8 3 13.36 3 9.2 3 6.47 5.1 4.5 7.6 4.5c1.7 0 3.24.88 4.4 2.42 1.16-1.54 2.7-2.42 4.4-2.42 2.5 0 4.6 1.97 4.6 4.7 0 4.16-4.1 7.6-8.02 10.94-.28.24-.63.36-.98.36Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ===== Information panel ===== */}
      <SwipePanel entry={entry} seeker={seeker} page={page} onPageChange={setPage} />
    </article>
  );
}

function ScorePill({ value, label }: { value: number | null; label: string }) {
  const text =
    value === null
      ? `${label} unavailable — add interests to your profile to see it`
      : `${label} ${value} out of 100, ${scoreLabel(value)}`;
  return (
    <div
      role="img"
      aria-label={text}
      title={text}
      className="flex items-center gap-2.5 rounded-full bg-black/45 py-1 pl-1 pr-3.5 text-white ring-1 ring-white/15 backdrop-blur-md"
    >
      <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/15 px-1.5 text-[15px] font-semibold tabular-nums">
        {value === null ? "—" : value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90">{label}</span>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === "left" ? <path d="M14.5 6 9 12l5.5 6" /> : <path d="M9.5 6 15 12l-5.5 6" />}
    </svg>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { NoPhoto } from "@/components/listings/NoPhoto";

const arrowButton =
  "absolute top-1/2 z-[1] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-surface/80 text-ink backdrop-blur transition-colors hover:border-accent hover:text-accent";

export function ListingGallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const total = photos.length;

  if (total === 0) {
    return (
      <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-hairline">
        <NoPhoto />
      </div>
    );
  }

  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);

  return (
    <div>
      <div
        role="group"
        aria-label={`Photos of ${title}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (total < 2) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            prev();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            next();
          }
        }}
        className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-hairline outline-none focus-visible:border-accent"
      >
        <Image
          src={photos[index]}
          alt={`${title} — photo ${index + 1} of ${total}`}
          fill
          sizes="(min-width: 768px) 728px, 100vw"
          className="object-cover"
        />
        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous photo"
              className={`${arrowButton} left-3`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14.5 6 9 12l5.5 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next photo"
              className={`${arrowButton} right-3`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.5 6 15 12l-5.5 6" />
              </svg>
            </button>
          </>
        ) : null}
      </div>
      <p aria-live="polite" className="mt-2 text-center text-xs text-muted">
        {index + 1}/{total}
      </p>
    </div>
  );
}

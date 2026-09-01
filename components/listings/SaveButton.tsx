"use client";

import { useState, useTransition } from "react";
import { setSavedAction } from "@/app/actions/saved";

/**
 * Heart toggle, signed-in only. Liking persists to `saved_listings` and shows
 * under Profile › Liked on every device, so there is nothing meaningful a
 * visitor could do with it — for them the button isn't rendered at all rather
 * than offered and then rejected.
 */
export function SaveButton({
  listingId,
  signedIn = false,
  initialSaved = false,
  className = "",
}: {
  listingId: string;
  signedIn?: boolean;
  initialSaved?: boolean;
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  if (!signedIn) return null;

  function toggle() {
    const next = !saved;
    setSaved(next); // optimistic
    startTransition(async () => {
      const { ok } = await setSavedAction(listingId, next);
      if (!ok) setSaved(!next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from liked rooms" : "Like this room"}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface/90 backdrop-blur transition-colors ${
        saved ? "text-accent" : "text-muted hover:text-ink"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}

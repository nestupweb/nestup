"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { PencilIcon } from "@/components/ui/PencilIcon";

/**
 * Full-size variant of the picture. Seed portraits are Unsplash thumbnails
 * cropped to 256px, so ask for a larger render; anything else is served as-is.
 */
export function fullSizeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.set("w", "1200");
      u.searchParams.delete("h");
      u.searchParams.delete("fit");
      u.searchParams.delete("crop");
      return u.toString();
    }
  } catch {
    /* not an absolute URL — leave untouched */
  }
  return url;
}

/**
 * The profile picture on /profile. Clicking the picture opens it full-size;
 * the pencil that appears on hover (always visible on touch screens, where
 * there is no hover) leads to the editor. Without a photo there is nothing to
 * enlarge, so the placeholder itself leads to the editor too.
 */
export function ProfileAvatar({ url, name }: { url: string | null; name: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pencil = (
    <Link
      href="/profile/edit"
      aria-label="Edit profile"
      className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface/95 text-ink opacity-0 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)] backdrop-blur transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <PencilIcon />
    </Link>
  );

  if (!url) {
    return (
      <div className="group relative shrink-0">
        <Link href="/profile/edit" aria-label="Add a profile photo" className="block rounded-full">
          <Avatar url={null} name={name} size={28} />
        </Link>
        {pencil}
      </div>
    );
  }

  return (
    <>
      <div className="group relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="View profile photo"
          className="block cursor-zoom-in rounded-full focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Avatar url={url} name={name} size={28} />
        </button>
        {pencil}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name}'s profile photo`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullSizeUrl(url)}
            alt={name}
            onClick={(e) => e.stopPropagation()}
            className="aspect-square h-auto w-[min(80vw,80dvh,32rem)] rounded-full object-cover shadow-2xl ring-4 ring-surface/30"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 text-lg leading-none text-ink hover:text-accent"
          >
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { MAX_PROFILE_PHOTOS } from "@/lib/constants";

type Extra = { kind: "existing"; url: string } | { kind: "added"; id: string; file: File; preview: string };

const circle = "h-20 w-20 shrink-0 rounded-full";

/**
 * Photos on the profile editor, circles only: the avatar (tap to replace),
 * any extra pictures (tap × to drop), and "+" circles to add more.
 * Submits `avatar` (one file), `existing_photos` (kept URLs) and `photos`
 * (new files) — the action uploads and stores them.
 */
export function ProfilePhotos({
  name,
  avatarUrl,
  photoUrls,
}: {
  name: string;
  avatarUrl: string | null;
  photoUrls: string[];
}) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [extras, setExtras] = useState<Extra[]>(() => photoUrls.map((url) => ({ kind: "existing", url })));
  const avatarInput = useRef<HTMLInputElement>(null);
  const photosInput = useRef<HTMLInputElement>(null);

  // Keep the real multi-file input equal to the "added" circles.
  useEffect(() => {
    const input = photosInput.current;
    if (!input || typeof DataTransfer === "undefined") return;
    try {
      const dt = new DataTransfer();
      for (const e of extras) if (e.kind === "added") dt.items.add(e.file);
      input.files = dt.files;
    } catch {
      /* older browsers keep whatever was picked */
    }
  }, [extras]);

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      for (const e of extras) if (e.kind === "added") URL.revokeObjectURL(e.preview);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const slotsLeft = MAX_PROFILE_PHOTOS - extras.length;

  return (
    <div className="mt-5">
      {extras.map((e) =>
        e.kind === "existing" ? <input key={e.url} type="hidden" name="existing_photos" value={e.url} /> : null
      )}
      <input
        ref={avatarInput}
        name="avatar"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Change profile photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setAvatarPreview(f ? URL.createObjectURL(f) : null);
        }}
        className="sr-only"
      />
      <input
        ref={photosInput}
        name="photos"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-label="Add photos"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, slotsLeft));
          setExtras((prev) => [
            ...prev,
            ...files.map((file) => ({
              kind: "added" as const,
              id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
              file,
              preview: URL.createObjectURL(file),
            })),
          ]);
        }}
        className="sr-only"
      />

      <ul className="flex flex-wrap items-center gap-3" aria-label="Your photos">
        <li>
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            aria-label={avatarUrl || avatarPreview ? "Change profile photo" : "Add profile photo"}
            title="Profile photo"
            className="block rounded-full ring-2 ring-accent ring-offset-2 ring-offset-paper transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4"
          >
            <Avatar url={avatarPreview ?? avatarUrl} name={name} size={20} />
          </button>
        </li>
        {extras.map((e, i) => (
          <li key={e.kind === "existing" ? e.url : e.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.kind === "existing" ? e.url : e.preview} alt={`Photo ${i + 2}`} className={`${circle} object-cover`} />
            <button
              type="button"
              aria-label={`Remove photo ${i + 2}`}
              onClick={() =>
                setExtras((prev) => {
                  const gone = prev[i];
                  if (gone?.kind === "added") URL.revokeObjectURL(gone.preview);
                  return prev.filter((_, j) => j !== i);
                })
              }
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-hairline bg-surface text-xs text-ink shadow hover:text-danger"
            >
              ×
            </button>
          </li>
        ))}
        {Array.from({ length: Math.min(2, Math.max(0, slotsLeft)) }).map((_, i) => (
          <li key={`plus-${i}`}>
            <button
              type="button"
              onClick={() => photosInput.current?.click()}
              aria-label="Add photo"
              className={`${circle} flex items-center justify-center border border-dashed border-hairline text-2xl font-light leading-none text-muted transition-colors hover:border-accent hover:text-accent`}
            >
              +
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

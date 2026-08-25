"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS, PHOTO_ROOMS, photoRoomLabel } from "@/lib/constants";
import { REQUIRED_PHOTO_ROOMS } from "@/lib/validation/listing";
import type { PhotoRoom } from "@/lib/types";

type Existing = { kind: "existing"; url: string; label: PhotoRoom };
type Added = { kind: "added"; id: string; file: File; preview: string; label: PhotoRoom };
type Item = Existing | Added;

const select =
  "mt-1.5 w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-accent";

/** Best guess for a fresh file's room from its name ("bedroom-2.jpg"). */
function guessRoom(fileName: string): PhotoRoom {
  const n = fileName.toLowerCase();
  for (const r of PHOTO_ROOMS) {
    if (r.hints.some((h) => n.includes(h))) return r.key;
  }
  return "other";
}

/**
 * 3–10 photos, each tagged with the room it shows. Kept photos submit as
 * `existing_photos` + `existing_labels`; new files travel in the `photos`
 * file input with `new_labels` in the same order.
 */
export function PhotoPicker({ initialUrls, initialLabels }: { initialUrls: string[]; initialLabels: string[] }) {
  const [items, setItems] = useState<Item[]>(() =>
    initialUrls.map((url, i) => ({
      kind: "existing",
      url,
      label: (PHOTO_ROOMS.some((r) => r.key === initialLabels[i]) ? initialLabels[i] : "other") as PhotoRoom,
    }))
  );
  const fileInput = useRef<HTMLInputElement>(null);

  // Mirror the "added" files into the real file input so the form submits them.
  useEffect(() => {
    const input = fileInput.current;
    if (!input || typeof DataTransfer === "undefined") return;
    try {
      const dt = new DataTransfer();
      for (const it of items) if (it.kind === "added") dt.items.add(it.file);
      input.files = dt.files;
    } catch {
      /* older browsers: the input keeps whatever the user picked */
    }
  }, [items]);

  useEffect(
    () => () => {
      for (const it of items) if (it.kind === "added") URL.revokeObjectURL(it.preview);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const covered = new Set(items.map((i) => i.label));
  const count = items.length;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_LISTING_PHOTOS - count;
    const fresh = Array.from(files)
      .slice(0, Math.max(0, room))
      .map<Added>((file) => ({
        kind: "added",
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
        label: guessRoom(file.name),
      }));
    setItems((prev) => [...prev, ...fresh]);
  };

  const setLabel = (index: number, label: PhotoRoom) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, label } : it)));
  const remove = (index: number) =>
    setItems((prev) => {
      const gone = prev[index];
      if (gone?.kind === "added") URL.revokeObjectURL(gone.preview);
      return prev.filter((_, i) => i !== index);
    });

  return (
    <div>
      {items.map((it) =>
        it.kind === "existing" ? (
          <span key={it.url}>
            <input type="hidden" name="existing_photos" value={it.url} />
            <input type="hidden" name="existing_labels" value={it.label} />
          </span>
        ) : (
          <input key={it.id} type="hidden" name="new_labels" value={it.label} />
        )
      )}
      {/* Real file input: hidden, driven by the tile below and kept in sync with state. */}
      <input
        ref={fileInput}
        name="photos"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-label="Add photos"
        onChange={(e) => addFiles(e.target.files)}
        className="sr-only"
      />

      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {items.map((it, i) => (
          <figure key={it.kind === "existing" ? it.url : it.id} className="min-w-0">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-hairline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.kind === "existing" ? it.url : it.preview}
                alt={`Photo ${i + 1}: ${photoRoomLabel(it.label)}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => remove(i)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white backdrop-blur hover:bg-black/75"
              >
                ×
              </button>
            </div>
            <label className="sr-only" htmlFor={`photo-room-${i}`}>
              Room shown in photo {i + 1}
            </label>
            <select
              id={`photo-room-${i}`}
              value={it.label}
              onChange={(e) => setLabel(i, e.target.value as PhotoRoom)}
              className={select}
            >
              {PHOTO_ROOMS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </figure>
        ))}
        {count < MAX_LISTING_PHOTOS ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest">Add photos</span>
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className={count >= MIN_LISTING_PHOTOS && count <= MAX_LISTING_PHOTOS ? "text-accent" : ""}>
          {count}/{MAX_LISTING_PHOTOS} photos · at least {MIN_LISTING_PHOTOS}
        </span>
        {REQUIRED_PHOTO_ROOMS.map((room) => (
          <span key={room} className={covered.has(room) ? "text-accent" : ""}>
            {covered.has(room) ? "✓" : "○"} {photoRoomLabel(room)}
          </span>
        ))}
      </div>
    </div>
  );
}

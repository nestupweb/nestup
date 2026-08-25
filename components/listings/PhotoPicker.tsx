"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-client";
import { MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS, PHOTO_ROOMS, photoRoomLabel } from "@/lib/constants";
import { REQUIRED_PHOTO_ROOMS } from "@/lib/validation/listing";
import type { PhotoRoom } from "@/lib/types";

type Item = {
  id: string;
  url: string | null; // public URL once uploaded
  preview: string; // what the tile shows (object URL until uploaded)
  label: PhotoRoom;
  status: "uploading" | "ready" | "failed";
  error?: string;
};

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
 * 3–10 photos, each tagged with the room it shows. Photos are compressed and
 * uploaded straight from the browser to the `listing-photos` bucket the
 * moment they're picked (the owner's folder — storage RLS), so the form
 * itself only submits URLs: `existing_photos` + `existing_labels`. That keeps
 * a 10-photo listing far below Vercel's request-body limit.
 */
export function PhotoPicker({
  userId,
  initialUrls,
  initialLabels,
}: {
  userId: string;
  initialUrls: string[];
  initialLabels: string[];
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initialUrls.map((url, i) => ({
      id: url,
      url,
      preview: url,
      label: (PHOTO_ROOMS.some((r) => r.key === initialLabels[i]) ? initialLabels[i] : "other") as PhotoRoom,
      status: "ready",
    }))
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      for (const it of itemsRef.current) if (it.preview.startsWith("blob:")) URL.revokeObjectURL(it.preview);
    },
    []
  );

  const count = items.length;
  const covered = new Set(items.filter((i) => i.status === "ready").map((i) => i.label));
  const uploading = items.some((i) => i.status === "uploading");

  const update = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const upload = async (id: string, file: File) => {
    try {
      const blob = await compressImage(file);
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("listing-photos")
        .upload(path, blob, { contentType: blob.type || "image/jpeg" });
      if (error) throw new Error("Upload failed — check your connection and try again.");
      const url = supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
      update(id, { url, status: "ready" });
    } catch (e) {
      update(id, { status: "failed", error: e instanceof Error ? e.message : "Upload failed." });
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_LISTING_PHOTOS - itemsRef.current.length;
    const fresh = Array.from(files).slice(0, Math.max(0, room));
    const next: Item[] = fresh.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      url: null,
      preview: URL.createObjectURL(file),
      label: guessRoom(file.name),
      status: "uploading",
    }));
    setItems((prev) => [...prev, ...next]);
    next.forEach((it, i) => void upload(it.id, fresh[i]));
    if (fileInput.current) fileInput.current.value = "";
  };

  const remove = (id: string) =>
    setItems((prev) => {
      const gone = prev.find((it) => it.id === id);
      if (gone?.preview.startsWith("blob:")) URL.revokeObjectURL(gone.preview);
      return prev.filter((it) => it.id !== id);
    });

  return (
    <div>
      {items
        .filter((it) => it.status === "ready" && it.url)
        .map((it) => (
          <span key={it.id}>
            <input type="hidden" name="existing_photos" value={it.url!} />
            <input type="hidden" name="existing_labels" value={it.label} />
          </span>
        ))}
      {/* Picker only — never submitted (photos are already in storage by then). */}
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/*"
        aria-label="Add photos"
        onChange={(e) => addFiles(e.target.files)}
        className="sr-only"
      />
      {uploading ? <input type="hidden" name="photos_uploading" value="1" /> : null}

      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {items.map((it, i) => (
          <figure key={it.id} className="min-w-0">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-hairline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.preview}
                alt={`Photo ${i + 1}: ${photoRoomLabel(it.label)}`}
                className={`h-full w-full object-cover transition-opacity ${it.status === "ready" ? "opacity-100" : "opacity-50"}`}
              />
              {it.status === "uploading" ? (
                <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[10px] font-semibold uppercase tracking-widest text-white">
                  Uploading…
                </span>
              ) : null}
              {it.status === "failed" ? (
                <span role="alert" className="absolute inset-x-0 bottom-0 bg-danger/90 px-1 py-1 text-center text-[10px] font-semibold leading-tight text-white">
                  {it.error ?? "Upload failed"}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => remove(it.id)}
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
              onChange={(e) => update(it.id, { label: e.target.value as PhotoRoom })}
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
        {uploading ? <span aria-live="polite">Uploading photos…</span> : null}
      </div>
    </div>
  );
}

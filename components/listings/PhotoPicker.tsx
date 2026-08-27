"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-client";
import { checkListingPhotoAction } from "@/app/actions/photo-check";
import { MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS, PHOTO_ROOMS, photoRoomLabel } from "@/lib/constants";
import { photoProblem, photoSubjectPhrase, suggestedRoom, type PhotoSubject } from "@/lib/photo-rules";
import { REQUIRED_PHOTO_ROOMS } from "@/lib/validation/listing";
import type { PhotoRoom } from "@/lib/types";

type Item = {
  id: string;
  name: string; // file name, for the line shown when a photo is turned away
  url: string | null; // public URL once uploaded
  path: string | null; // storage path (only for photos uploaded in this session)
  preview: string; // what the tile shows (object URL until uploaded)
  label: PhotoRoom;
  status: "uploading" | "checking" | "ready" | "failed";
  error?: string;
  /** What the check saw, plus the signed verdict the server will trust at publish. */
  subject?: PhotoSubject;
  token?: string;
  note?: string;
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

/** The message shown on a tile whose photo doesn't fit its tag (null when it does). */
function problemOf(it: Item): string | null {
  if (it.status !== "ready" || !it.subject) return null;
  return photoProblem(it.subject, it.label);
}

/**
 * 3–10 photos, each tagged with the room it shows. Photos are compressed and
 * uploaded straight from the browser to the `listing-photos` bucket the
 * moment they're picked (the owner's folder — storage RLS), then looked at by
 * the photo check.
 *
 * A photo that isn't of the apartment never makes it onto the form: it is
 * taken straight back out of the grid and out of storage, and a line above
 * the grid says which photo went and why. A room photo under the wrong strict
 * tag is re-tagged to the room it actually shows. The form itself only
 * submits URLs: `existing_photos` + `existing_labels` + `photo_tokens` (the
 * signed verdicts).
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
      name: "this photo",
      url,
      path: null,
      preview: url,
      label: (PHOTO_ROOMS.some((r) => r.key === initialLabels[i]) ? initialLabels[i] : "other") as PhotoRoom,
      status: "ready",
    }))
  );
  /** "Removed <photo> — <why>" lines for photos the check turned away. */
  const [notices, setNotices] = useState<{ id: string; text: string }[]>([]);
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
  const covered = new Set(items.filter((i) => i.status === "ready" && !problemOf(i)).map((i) => i.label));
  const busy = items.some((i) => i.status === "uploading" || i.status === "checking");
  const flagged = items.some((i) => problemOf(i) !== null);

  const update = (id: string, patch: Partial<Item> | ((it: Item) => Partial<Item>)) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...(typeof patch === "function" ? patch(it) : patch) } : it))
    );

  const remove = (id: string) =>
    setItems((prev) => {
      const gone = prev.find((it) => it.id === id);
      if (gone?.preview.startsWith("blob:")) URL.revokeObjectURL(gone.preview);
      return prev.filter((it) => it.id !== id);
    });

  const discard = async (path: string | null) => {
    if (!path) return;
    await createClient().storage.from("listing-photos").remove([path]);
  };

  /** Ask the server what the photo shows; retags it when the photo clearly shows another room. */
  const check = async (id: string, url: string, path: string | null, label: PhotoRoom) => {
    update(id, { status: "checking", error: undefined });
    const result = await checkListingPhotoAction(url, label);
    if (!result.ok) {
      update(id, { status: "failed", error: result.error });
      return;
    }
    if (!result.checked) {
      update(id, { status: "ready" });
      return;
    }
    if (result.subject === "not_apartment") {
      // Not a photo of the home: out of the grid and out of the bucket, right away.
      const gone = itemsRef.current.find((it) => it.id === id);
      setNotices((prev) => [
        ...prev,
        {
          id,
          text: `Removed ${gone?.name ?? "that photo"} — ${result.reason} Only photos of the apartment are accepted.`,
        },
      ]);
      remove(id);
      void discard(path);
      return;
    }
    const room = suggestedRoom(result.subject);
    update(id, (it) => {
      if (photoProblem(result.subject, it.label) === null) {
        return { status: "ready", subject: result.subject, token: result.token, note: undefined };
      }
      // A room photo under the wrong strict tag moves to the room it shows;
      // something unidentifiable (a hallway) becomes "Other", which is honest.
      const next = room ?? "other";
      const note = room
        ? `Tagged as ${photoRoomLabel(next)} — that is what the photo shows.`
        : `Tagged as Other — we couldn't see ${photoSubjectPhrase(it.label as PhotoSubject)} here.`;
      return { status: "ready", subject: result.subject, token: result.token, label: next, note };
    });
  };

  const upload = async (id: string, file: File, label: PhotoRoom) => {
    let path: string | null = null;
    try {
      const blob = await compressImage(file);
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("listing-photos")
        .upload(path, blob, { contentType: blob.type || "image/jpeg" });
      if (error) throw new Error("Upload failed — check your connection and try again.");
      const url = supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
      update(id, { url, path });
      await check(id, url, path, label);
    } catch (e) {
      update(id, { status: "failed", error: e instanceof Error ? e.message : "Upload failed." });
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setNotices([]); // a fresh attempt clears what the last one said
    const room = MAX_LISTING_PHOTOS - itemsRef.current.length;
    const fresh = Array.from(files).slice(0, Math.max(0, room));
    const next: Item[] = fresh.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      url: null,
      path: null,
      preview: URL.createObjectURL(file),
      label: guessRoom(file.name),
      status: "uploading",
    }));
    setItems((prev) => [...prev, ...next]);
    next.forEach((it, i) => void upload(it.id, fresh[i], it.label));
    if (fileInput.current) fileInput.current.value = "";
  };

  const retag = (it: Item, label: PhotoRoom) => {
    update(it.id, { label, note: undefined });
    // A photo saved before the check existed has no verdict yet — get one for its new tag.
    if (it.status === "ready" && !it.subject && it.url) void check(it.id, it.url, it.path, label);
  };

  return (
    <div>
      {items
        .filter((it) => it.status === "ready" && it.url && !problemOf(it))
        .map((it) => (
          <span key={it.id}>
            <input type="hidden" name="existing_photos" value={it.url!} />
            <input type="hidden" name="existing_labels" value={it.label} />
            <input type="hidden" name="photo_tokens" value={it.token ?? ""} />
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
      {busy ? <input type="hidden" name="photos_uploading" value="1" /> : null}
      {flagged ? <input type="hidden" name="photos_flagged" value="1" /> : null}

      {notices.map((n) => (
        <p
          key={n.id}
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          <span className="flex-1">{n.text}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setNotices((prev) => prev.filter((x) => x.id !== n.id))}
            className="shrink-0 px-1 leading-none text-danger/70 hover:text-danger"
          >
            ×
          </button>
        </p>
      ))}

      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {items.map((it, i) => {
          const problem = problemOf(it);
          const overlay = it.status === "failed" ? (it.error ?? "Upload failed") : problem;
          const dim = it.status !== "ready" || problem !== null;
          return (
            <figure key={it.id} className="min-w-0">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-hairline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.preview}
                  alt={`Photo ${i + 1}: ${photoRoomLabel(it.label)}`}
                  className={`h-full w-full object-cover transition-opacity ${dim ? "opacity-50" : "opacity-100"}`}
                />
                {it.status === "uploading" || it.status === "checking" ? (
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[11px] font-semibold uppercase tracking-widest text-white">
                    {it.status === "uploading" ? "Uploading…" : "Checking…"}
                  </span>
                ) : null}
                {overlay ? (
                  <span
                    role="alert"
                    className="absolute inset-x-0 bottom-0 max-h-full overflow-y-auto bg-danger/90 px-1.5 py-1 text-center text-[11px] font-semibold leading-tight text-white"
                  >
                    {overlay}
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
                onChange={(e) => retag(it, e.target.value as PhotoRoom)}
                className={select}
              >
                {PHOTO_ROOMS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              {it.note ? <figcaption className="mt-1 text-[11px] leading-tight text-accent">{it.note}</figcaption> : null}
            </figure>
          );
        })}
        {count < MAX_LISTING_PHOTOS ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest">Add photos</span>
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
        {busy ? (
          <span aria-live="polite">
            {items.some((i) => i.status === "uploading") ? "Uploading photos…" : "Checking photos…"}
          </span>
        ) : null}
        {flagged ? <span className="text-danger">Fix or remove the flagged photo to publish.</span> : null}
      </div>
    </div>
  );
}

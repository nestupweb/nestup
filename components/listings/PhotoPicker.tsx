"use client";

import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/image-client";
import { checkAndUploadPhotoAction, checkStoredPhotoAction, type PhotoCheckResult } from "@/app/actions/photo-check";
import { MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS, PHOTO_ROOMS, PHOTO_ROOM_CHOICES, photoRoomLabel } from "@/lib/constants";
import { photoProblem, type PhotoSubject } from "@/lib/photo-rules";
import { REQUIRED_PHOTO_ROOMS } from "@/lib/validation/listing";
import type { PhotoRoom } from "@/lib/types";

/**
 * The room a tile is tagged with. "" is "nobody has said yet" — there is no
 * "Other" to fall into any more, so a photo whose room the file name could not
 * name waits for the member to say before it is checked at all.
 */
type Tag = PhotoRoom | "";

type Item = {
  id: string;
  name: string; // file name, for the line shown when a photo is turned away
  url: string | null; // public URL, set once the photo has passed and been stored
  preview: string; // what the tile shows (object URL until stored)
  label: Tag;
  /** Held until the photo passes; that is the only copy of it that exists. */
  file: File | null;
  status: "waiting" | "checking" | "ready" | "failed";
  /** Why this photo has not been accepted — the sentence from the check. */
  error?: string;
  /** What the check saw, plus the signed verdict the server will trust at publish. */
  subject?: PhotoSubject;
  token?: string;
};

const select =
  "mt-1.5 w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-accent";

/** Best guess for a fresh file's room from its name ("bedroom-2.jpg"); "" when the name says nothing. */
function guessRoom(fileName: string): Tag {
  const n = fileName.toLowerCase();
  for (const r of PHOTO_ROOM_CHOICES) {
    if (r.hints.some((h) => n.includes(h))) return r.key;
  }
  return "";
}

/** The message shown on a tile that isn't ready to be published (null when it is). */
function problemOf(it: Item): string | null {
  if (it.status === "checking") return null;
  if (it.error) return it.error;
  if (!it.label) return "Pick the room this photo shows.";
  if (it.status !== "ready") return null;
  if (!it.subject) return null;
  return photoProblem(it.subject, it.label);
}

/**
 * 3–10 photos, each tagged with the room it shows.
 *
 * Every photo is checked by Gemini on the server **before it is uploaded**:
 * the browser compresses the file and sends the bytes to
 * `checkAndUploadPhotoAction`, which shows them to the model and only stores
 * the photo if it really is the room the member tagged. A living-room tag on a
 * bedroom photo, a balcony tag on a kitchen, a dog under any tag — all are
 * refused, and the file never reaches the `listing-photos` bucket.
 *
 * A refused photo keeps its tile (the file is still here, unsent) so the
 * member can put it under the right room and have it re-checked; only a photo
 * that is not of a home at all is taken out of the grid entirely. The form
 * submits URLs: `existing_photos` + `existing_labels` + `photo_tokens` (the
 * signed verdicts `saveListingAction` re-checks at publish).
 */
export function PhotoPicker({
  initialUrls,
  initialLabels,
}: {
  /** Kept for the form's call site; the server now derives the folder from the session. */
  userId?: string;
  initialUrls: string[];
  initialLabels: string[];
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initialUrls.map((url, i) => ({
      id: url,
      name: "this photo",
      url,
      preview: url,
      label: (PHOTO_ROOMS.some((r) => r.key === initialLabels[i]) ? initialLabels[i] : "") as Tag,
      file: null,
      status: "ready",
    }))
  );
  /** "Removed <photo> — <why>" lines for photos that are not of a home at all. */
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
  const busy = items.some((i) => i.status === "checking");
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

  /** Not a home at all: out of the grid, with a red line saying which photo and why. */
  const turnAway = (id: string, reason: string) => {
    const gone = itemsRef.current.find((it) => it.id === id);
    setNotices((prev) => [
      ...prev,
      { id, text: `Removed ${gone?.name ?? "that photo"} — ${reason} Only photos of the apartment are accepted.` },
    ]);
    remove(id);
  };

  /** Fold one server answer into the tile it belongs to. */
  const settle = (id: string, result: PhotoCheckResult) => {
    if (result.ok) {
      update(id, (it) => {
        if (it.preview.startsWith("blob:")) URL.revokeObjectURL(it.preview);
        return {
          status: "ready",
          url: result.url,
          preview: result.url,
          file: null,
          error: undefined,
          subject: result.checked ? result.subject : undefined,
          token: result.checked ? result.token : undefined,
        };
      });
      return;
    }
    if (!result.rejected) {
      update(id, { status: "failed", error: result.error });
      return;
    }
    // Refused. Nothing was stored — the tile keeps the file so the member can
    // re-tag it and have it looked at again.
    if (result.subject === "not_apartment") {
      turnAway(id, result.reason);
      return;
    }
    update(id, { status: "waiting", error: result.message, subject: undefined, token: undefined });
  };

  /** Send one photo's bytes to be checked, and stored only if it passes. */
  const verify = async (id: string, file: File, label: PhotoRoom) => {
    update(id, { status: "checking", error: undefined });
    try {
      const body = new FormData();
      const blob = await compressImage(file);
      body.append("photo", blob, file.name);
      body.append("label", label);
      settle(id, await checkAndUploadPhotoAction(body));
    } catch (e) {
      update(id, { status: "failed", error: e instanceof Error ? e.message : "Could not read this photo." });
    }
  };

  /** Re-check a photo that is already stored (only photos saved before the check existed). */
  const verifyStored = async (id: string, url: string, label: PhotoRoom) => {
    update(id, { status: "checking", error: undefined });
    settle(id, await checkStoredPhotoAction(url, label));
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
      preview: URL.createObjectURL(file),
      label: guessRoom(file.name),
      file,
      status: "waiting",
    }));
    setItems((prev) => [...prev, ...next]);
    // One at a time: the free Gemini tier is per-minute, and ten photos at
    // once would spend a whole minute's worth of it in a single burst.
    void (async () => {
      for (const it of next) {
        if (it.label) await verify(it.id, it.file!, it.label);
      }
    })();
    if (fileInput.current) fileInput.current.value = "";
  };

  const retag = (it: Item, label: Tag) => {
    update(it.id, { label, error: undefined });
    if (!label) return;
    // Not stored yet — it was either refused or waiting for a room. Look again
    // now that we know what the member says it is.
    if (it.file) {
      void verify(it.id, it.file, label);
      return;
    }
    // Already in storage but with no verdict: a photo saved before the check
    // existed, or one whose last tag it refused. Look again for the new tag.
    if (it.url && !it.subject && it.status !== "checking") void verifyStored(it.id, it.url, label);
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
                {it.status === "checking" ? (
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[11px] font-semibold uppercase tracking-widest text-white">
                    Checking…
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
                onChange={(e) => retag(it, e.target.value as Tag)}
                className={`${select} ${it.label ? "" : "text-muted"}`}
              >
                {/* Shown until the room is known, and never selectable again. */}
                {it.label ? null : (
                  <option value="" disabled>
                    Which room?
                  </option>
                )}
                {PHOTO_ROOM_CHOICES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
                {/* "Other" is gone from the choices; a photo saved under it before
                    that keeps its own tag until the member picks a real room. */}
                {it.label === "other" ? <option value="other">{photoRoomLabel("other")}</option> : null}
              </select>
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
        {busy ? <span aria-live="polite">Checking photos…</span> : null}
        {flagged ? <span className="text-danger">Tag or remove the marked photo to publish.</span> : null}
      </div>
    </div>
  );
}

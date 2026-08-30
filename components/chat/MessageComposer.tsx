"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { CHAT_MEDIA_ACCEPT, MAX_CHAT_MEDIA_BYTES, prepareChatMedia } from "@/lib/chat-media";

type Attachment = {
  preview: string;
  /**
   * The object URL made from the picked file, kept only so it can be revoked,
   * once `preview` has been swapped for the re-encoded copy (see `attach`).
   */
  superseded?: string;
  path: string | null;
  kind: "image" | "video";
  status: "uploading" | "ready" | "failed";
  error?: string;
};

/** Drop every object URL an attachment created. */
function revokePreviews(att: Attachment) {
  for (const url of [att.preview, att.superseded]) {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

export interface SendPayload {
  content: string;
  imagePath: string | null;
  /** Object URL of the attachment, shown until the server copy arrives. Ownership passes to the caller. */
  imagePreview: string | null;
}

/**
 * The "Write a message" box. Sending hands the payload to the thread (which
 * shows it immediately) and clears the field without remounting it, so the
 * cursor stays put and the user can keep typing.
 *
 * `initialText` seeds the field once, on mount: it is a starting point, never a
 * value the box is held to, so every keystroke after that is the member's.
 */
export function MessageComposer({
  conversationId,
  onSend,
  onSchedule,
  scheduleBlocked = false,
  initialText = "",
}: {
  conversationId: string;
  onSend: (payload: SendPayload) => void;
  onSchedule?: () => void;
  /** A viewing is already open in this chat — the button explains instead of opening the sheet. */
  scheduleBlocked?: boolean;
  /** Pre-filled draft, editable — used for the default hello when reaching out about a room. */
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);
  const [image, setImage] = useState<Attachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploading = image?.status === "uploading";
  const hasImage = image?.status === "ready" && Boolean(image.path);
  const canSend = (text.trim().length > 0 || hasImage) && !uploading;

  function submit() {
    if (!canSend) return;
    const ready = hasImage ? image! : null;
    onSend({ content: text.trim(), imagePath: ready?.path ?? null, imagePreview: ready?.preview ?? null });
    setText("");
    if (image && !ready) revokePreviews(image);
    // A sent attachment hands `preview` to the thread, but the superseded URL
    // is ours to drop.
    if (image && ready?.superseded?.startsWith("blob:")) URL.revokeObjectURL(ready.superseded);
    setImage(null);
    // The field never remounts, so focus survives; re-assert it in case the Send button was clicked.
    textareaRef.current?.focus();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline — messenger convention.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function attach(file: File | undefined) {
    if (!file) return;
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const preview = URL.createObjectURL(file);
    // Checked before the upload starts: a 400 MB clip should fail instantly,
    // not after minutes on a phone connection (the bucket refuses it anyway).
    if (file.size > MAX_CHAT_MEDIA_BYTES) {
      setImage({
        preview,
        path: null,
        kind,
        status: "failed",
        error: `That ${kind} is too large — the limit is ${Math.round(MAX_CHAT_MEDIA_BYTES / 1024 / 1024)} MB.`,
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImage({ preview, path: null, kind, status: "uploading" });
    // Whichever object URL the attachment is showing right now: the picked file
    // to begin with, the re-encoded copy once there is one.
    let shown = preview;
    try {
      const media = await prepareChatMedia(file, conversationId);
      /*
       * The preview above was made from the picked file, which for an iPhone
       * HEIC is a file this browser cannot paint — a broken thumbnail here, and
       * a broken image in the bubble too, since this URL is what the thread
       * shows until the server copy arrives. Once the file has been re-encoded,
       * preview the copy instead; it is a JPEG by construction.
       */
      if (kind === "image" && media.blob !== file) {
        shown = URL.createObjectURL(media.blob);
        setImage((img) => (img && img.preview === preview ? { ...img, preview: shown, superseded: preview } : img));
      }
      const { error } = await createClient()
        .storage.from("chat-images")
        .upload(media.path, media.blob, { contentType: media.contentType });
      if (error) throw new Error("Upload failed — check your connection and try again.");
      setImage((img) => (img && img.preview === shown ? { ...img, path: media.path, status: "ready" } : img));
    } catch (e) {
      setImage((img) =>
        img && img.preview === shown
          ? { ...img, status: "failed", error: e instanceof Error ? e.message : "Upload failed." }
          : img
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const removeImage = () => {
    if (image) revokePreviews(image);
    setImage(null);
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        ref={fileRef}
        type="file"
        accept={CHAT_MEDIA_ACCEPT}
        aria-label="Attach a photo or video"
        className="sr-only"
        onChange={(e) => void attach(e.target.files?.[0])}
      />

      {image ? (
        <div className="mb-2 flex items-end gap-3">
          <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface">
            {image.kind === "video" ? (
              <video
                src={image.preview}
                muted
                playsInline
                preload="metadata"
                aria-label="Video to send"
                className={`h-24 w-auto max-w-[12rem] object-cover transition-opacity ${image.status === "ready" ? "opacity-100" : "opacity-50"}`}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={image.preview}
                alt="Photo to send"
                className={`h-24 w-auto max-w-[12rem] object-cover transition-opacity ${image.status === "ready" ? "opacity-100" : "opacity-50"}`}
              />
            )}
            {image.status === "uploading" ? (
              <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[10px] font-semibold uppercase tracking-widest text-white">
                Uploading…
              </span>
            ) : null}
            <button
              type="button"
              onClick={removeImage}
              aria-label={image.kind === "video" ? "Remove video" : "Remove photo"}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white backdrop-blur hover:bg-black/75"
            >
              ×
            </button>
          </div>
          {image.status === "failed" ? <p role="alert" className="text-sm text-danger">{image.error}</p> : null}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        {onSchedule ? (
          <button
            type="button"
            onClick={onSchedule}
            aria-label="Schedule a viewing"
            aria-disabled={scheduleBlocked || undefined}
            title={scheduleBlocked ? "A viewing is already scheduled — cancel it first" : "Schedule a viewing"}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-muted transition-colors ${
              scheduleBlocked ? "opacity-50" : "hover:border-accent hover:text-accent"
            }`}
          >
            <CalendarIcon />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Add a photo or video"
          title="Add a photo or video"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <PhotoIcon />
        </button>
        <label htmlFor="chat-message" className="sr-only">Message</label>
        <textarea
          ref={textareaRef}
          id="chat-message"
          name="content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={1}
          autoComplete="off"
          placeholder={hasImage ? "Add a caption (optional)…" : "Write a message…"}
          onKeyDown={onKeyDown}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-3xl border border-hairline bg-surface px-4 py-3 text-[16px] leading-5 text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast transition-opacity disabled:opacity-60"
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
}

/** Symmetric arrow so it sits dead-centre in the round button. */
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="m5.5 11.5 6.5-6.5 6.5 6.5" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m20.5 15.5-4.5-4.5-7 7" />
    </svg>
  );
}

export function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8.5 14.5h2M13.5 14.5h2" />
    </svg>
  );
}

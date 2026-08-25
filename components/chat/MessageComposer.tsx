"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { sendMessageAction, type SendMessageState } from "@/app/actions/chat";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-client";

type Attachment = { preview: string; path: string | null; status: "uploading" | "ready" | "failed"; error?: string };

export function MessageComposer({
  conversationId,
  onSchedule,
}: {
  conversationId: string;
  onSchedule?: () => void;
}) {
  const [state, formAction, pending] = useActionState<SendMessageState, FormData>(
    sendMessageAction,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<Attachment | null>(null);

  // A successful send remounts the form (key below); drop the attachment with it.
  useEffect(() => {
    setImage((img) => {
      if (img?.preview.startsWith("blob:")) URL.revokeObjectURL(img.preview);
      return null;
    });
  }, [state.sentNonce]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline — messenger convention.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.currentTarget.value.trim() || image?.status === "ready") formRef.current?.requestSubmit();
    }
  }

  async function attach(file: File | undefined) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImage({ preview, path: null, status: "uploading" });
    try {
      const blob = await compressImage(file);
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from("chat-images")
        .upload(path, blob, { contentType: blob.type || "image/jpeg" });
      if (error) throw new Error("Upload failed — check your connection and try again.");
      setImage((img) => (img && img.preview === preview ? { ...img, path, status: "ready" } : img));
    } catch (e) {
      setImage((img) =>
        img && img.preview === preview
          ? { ...img, status: "failed", error: e instanceof Error ? e.message : "Upload failed." }
          : img
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const removeImage = () => {
    if (image?.preview.startsWith("blob:")) URL.revokeObjectURL(image.preview);
    setImage(null);
  };

  const uploading = image?.status === "uploading";
  const hasImage = image?.status === "ready" && image.path;

  return (
    // key: a new sentNonce after a successful send remounts the form, clearing the
    // textarea. On error the nonce is unchanged and defaultValue echoes the draft back
    // (React 19 resets uncontrolled fields after every action).
    <form ref={formRef} action={formAction} key={state.sentNonce ?? 0}>
      <input type="hidden" name="conversation_id" value={conversationId} />
      {hasImage ? <input type="hidden" name="image_path" value={image.path!} /> : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Attach a photo"
        className="sr-only"
        onChange={(e) => void attach(e.target.files?.[0])}
      />

      {image ? (
        <div className="mb-2 flex items-end gap-3">
          <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.preview}
              alt="Photo to send"
              className={`h-24 w-auto max-w-[12rem] object-cover transition-opacity ${image.status === "ready" ? "opacity-100" : "opacity-50"}`}
            />
            {image.status === "uploading" ? (
              <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[10px] font-semibold uppercase tracking-widest text-white">
                Uploading…
              </span>
            ) : null}
            <button
              type="button"
              onClick={removeImage}
              aria-label="Remove photo"
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
            title="Schedule a viewing"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <CalendarIcon />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Add a photo"
          title="Add a photo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <PhotoIcon />
        </button>
        <label htmlFor="chat-message" className="sr-only">Message</label>
        <textarea
          id="chat-message"
          name="content"
          required={!hasImage}
          maxLength={2000}
          rows={1}
          autoComplete="off"
          placeholder={hasImage ? "Add a caption (optional)…" : "Write a message…"}
          onKeyDown={onKeyDown}
          defaultValue={state.error ? state.content ?? "" : ""}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-3xl border border-hairline bg-surface px-4 py-3 text-[16px] leading-5 text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending || uploading}
          aria-label={pending ? "Sending" : "Send"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast transition-opacity disabled:opacity-60"
        >
          <SendIcon />
        </button>
      </div>
      {state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}
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

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { saveIntroTemplateAction, sendIntroAction } from "@/app/actions/swipe";
import { Avatar } from "@/components/ui/Avatar";
import { renderIntro } from "@/lib/swipe-intro";
import type { Profile } from "@/lib/types";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; conversationId: string }
  | { kind: "error"; message: string };
type Saved = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error" };

/** Who the message is going to: "Dana", "Dana & Noa", "Dana, Noa & Amir". */
export function householdName(household: Profile[]): string {
  const names = household.map((p) => p.full_name.split(" ")[0]);
  if (names.length <= 1) return names[0] ?? "the host";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/**
 * The first message to a household, written before the chat exists: a
 * ready-made hello — the seeker's own template if they saved one — editable,
 * over whatever page opened it.
 *
 * Two entry points share this sheet, and they differ only in wording and in
 * what happens after the send. The deck (`IntroSheet`) opens it on a like and
 * closes it the moment the message is away, because the next room is waiting
 * behind it. The listing page opens it from "Message the owner" and stays where
 * it is: the sheet reports that the message went and offers the conversation as
 * a link, rather than pulling the seeker off the room they were reading.
 *
 * Nothing is created until "Send": closing this — Cancel, Escape, the backdrop
 * — leaves no conversation behind.
 */
export function IntroDialog({
  listingId,
  household,
  template = "",
  eyebrow,
  title,
  sendLabel = "Send",
  cancelLabel = "Cancel",
  onClose,
  onSent,
}: {
  listingId: string;
  /** Everyone the message reaches, owner first — the first name fills {name}. */
  household: Profile[];
  /** The seeker's saved default hello (Profile › Default hello message). */
  template?: string;
  /** Optional kicker above the title. Omitted where there is nothing true to say. */
  eyebrow?: string;
  title?: string;
  sendLabel?: string;
  cancelLabel?: string;
  /** Cancel, Escape, backdrop, and the success state's Close all land here. */
  onClose: () => void;
  /** The message is away; the thread exists. */
  onSent?: (conversationId: string) => void;
}) {
  const host = household[0]?.full_name ?? "";
  const [text, setText] = useState(() => renderIntro(template, host));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saved, setSaved] = useState<Saved>({ kind: "idle" });
  const [savedText, setSavedText] = useState(() => renderIntro(template, host));

  // Escape closes (and, before a send, that means nothing was created).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    if (status.kind === "sending" || status.kind === "sent" || !text.trim()) return;
    setStatus({ kind: "sending" });
    try {
      const r = await sendIntroAction(listingId, text);
      if (r.ok) {
        setStatus({ kind: "sent", conversationId: r.conversationId });
        onSent?.(r.conversationId);
        return;
      }
      setStatus({ kind: "error", message: r.error });
    } catch {
      setStatus({ kind: "error", message: "Could not send the message. Please try again." });
    }
  };

  const saveDefault = async () => {
    if (saved.kind === "saving" || !text.trim()) return;
    setSaved({ kind: "saving" });
    try {
      const r = await saveIntroTemplateAction(text.trim());
      if (r.ok) {
        setSavedText(text.trim());
        setSaved({ kind: "saved" });
      } else {
        setSaved({ kind: "error" });
      }
    } catch {
      setSaved({ kind: "error" });
    }
  };

  const who = householdName(household);
  const edited = text.trim() !== "" && text.trim() !== savedText.trim();
  const sent = status.kind === "sent";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} data-cursor="arrow" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        className="swipe-enter relative w-full max-w-lg rounded-t-[28px] border border-hairline bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5)] sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2.5">
            {household.slice(0, 3).map((p) => (
              <Avatar key={p.user_id} url={p.avatar_url} name={p.full_name} size={10} className="ring-2 ring-surface" />
            ))}
          </div>
          <div className="min-w-0">
            {eyebrow && !sent ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
            ) : null}
            <h2 id="intro-title" className="truncate text-xl font-semibold leading-tight">
              {sent ? "Message sent" : (title ?? `Say hi to ${who}?`)}
            </h2>
          </div>
        </div>

        {sent ? (
          <>
            <p role="status" className="mt-4 text-sm text-muted">
              {who} {household.length > 1 ? "have" : "has"} your message. Everything from here happens in the chat.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Close
              </button>
              <Link
                href={`/chat/${status.conversationId}`}
                className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast"
              >
                Open the conversation
              </Link>
            </div>
          </>
        ) : (
          <>
            <label htmlFor="intro-message" className="sr-only">
              Message to the roommates
            </label>
            <textarea
              id="intro-message"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (saved.kind !== "idle") setSaved({ kind: "idle" });
              }}
              rows={3}
              maxLength={2000}
              className="mt-4 w-full resize-none rounded-2xl border border-hairline bg-paper px-4 py-3 text-[16px] leading-6 text-ink outline-none focus:border-accent"
            />
            <div className="mt-1.5 flex min-h-5 items-center justify-between gap-3 text-xs text-muted">
              <span>
                {saved.kind === "saved"
                  ? "Saved as your default hello."
                  : saved.kind === "error"
                    ? "Couldn't save the default — try again."
                    : "Edit the text as you like."}
              </span>
              {edited || saved.kind === "error" ? (
                <button
                  type="button"
                  onClick={saveDefault}
                  disabled={saved.kind === "saving"}
                  className="shrink-0 font-semibold text-accent underline-offset-2 hover:underline disabled:opacity-60"
                >
                  {saved.kind === "saving" ? "Saving…" : "Save as my default"}
                </button>
              ) : null}
            </div>
            {status.kind === "error" ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {status.message}
              </p>
            ) : null}

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={send}
                disabled={status.kind === "sending" || !text.trim()}
                className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast transition-opacity disabled:opacity-60"
              >
                {status.kind === "sending" ? "Sending…" : sendLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

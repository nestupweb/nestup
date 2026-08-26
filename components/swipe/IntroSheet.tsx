"use client";

import { useEffect, useState } from "react";
import { saveIntroTemplateAction, sendIntroAction } from "@/app/actions/swipe";
import { Avatar } from "@/components/ui/Avatar";
import { introMessage, type DeckEntry } from "@/lib/swipe";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string };
type Saved = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error" };

/**
 * Appears the moment a room is liked, over the card: a ready-made hello to
 * the household — the seeker's own template if they saved one — editable,
 * optional. Sending posts it to the listing's chat and closes the sheet at
 * once (the deck then slides the card away); "Save as my default" keeps an
 * edited text for every future like.
 */
export function IntroSheet({ entry, template = "", onClose }: { entry: DeckEntry; template?: string; onClose: () => void }) {
  const [text, setText] = useState(() => introMessage(entry, template));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saved, setSaved] = useState<Saved>({ kind: "idle" });
  const [savedText, setSavedText] = useState(() => introMessage(entry, template));
  const household = [entry.owner, ...entry.residents];

  // Escape closes (counts as "not now").
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    if (status.kind === "sending" || !text.trim()) return;
    setStatus({ kind: "sending" });
    try {
      const r = await sendIntroAction(entry.listing.id, text);
      if (r.ok) {
        onClose();
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

  const names = household.map((p) => p.full_name.split(" ")[0]);
  const who =
    names.length <= 1 ? names[0] ?? "the host" : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  const edited = text.trim() !== "" && text.trim() !== savedText.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">You liked this room</p>
            <h2 id="intro-title" className="truncate text-xl font-semibold leading-tight">
              Say hi to {who}?
            </h2>
          </div>
        </div>

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
            Not now
          </button>
          <button
            type="button"
            onClick={send}
            disabled={status.kind === "sending" || !text.trim()}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast transition-opacity disabled:opacity-60"
          >
            {status.kind === "sending" ? "Sending…" : "Send message"}
          </button>
        </div>
      </div>
    </div>
  );
}

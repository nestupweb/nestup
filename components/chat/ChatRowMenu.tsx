"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { deleteConversationAction } from "@/app/actions/chat";

/**
 * The per-row "⋮ → Delete chat" on the Chats list, WhatsApp-style: the thread
 * leaves *this* member's inbox and its history stops being shown to them. The
 * other side keeps everything, and their next message brings the chat back
 * carrying that message alone — which is what the confirmation says out loud,
 * so nobody deletes expecting it to reach the other person.
 *
 * The button is a sibling of the row's <Link> (a button inside a link is
 * invalid), revealed on hover on a mouse and always there on a touch screen.
 */
export function ChatRowMenu({ conversationId, title }: { conversationId: string; title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const remove = () =>
    startTransition(async () => {
      const res = await deleteConversationAction(conversationId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConfirming(false);
      // The deleted thread may be the one open on the right-hand pane.
      if (pathname === `/chat/${conversationId}`) router.replace("/chat");
      else router.refresh();
    });

  return (
    <div ref={root} className="relative flex items-center pr-2 lg:pr-3">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Options for the chat with ${title}`}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-muted transition-opacity hover:bg-hairline/60 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Chat options"
          className="absolute right-1 top-full z-30 mt-1 min-w-[11rem] overflow-hidden rounded-2xl border border-hairline bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setError(null);
              setConfirming(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9.5 7V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V7" />
            </svg>
            Delete chat
          </button>
        </div>
      ) : null}

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Close"
            onClick={() => (pending ? undefined : setConfirming(false))}
            data-cursor="arrow"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${menuId}-title`}
            className="relative w-full max-w-sm rounded-t-3xl border border-hairline bg-paper p-5 text-left shadow-2xl sm:rounded-3xl"
          >
            <h2 id={`${menuId}-title`} className="text-xl font-bold leading-tight">
              Delete this chat?
            </h2>
            {/* Phrased around the name, never through it: `title` is one member on
                the household side and "Avi, Daniel & Lior" on the seeker's. */}
            <p className="mt-2 text-sm text-muted">
              It leaves your Chats and the messages stop showing for you. The conversation stays with {title}, and
              their next message brings it back.
            </p>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-hairline/50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                disabled={pending}
                onClick={remove}
                className="rounded-full border border-danger bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/15 disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Delete chat"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

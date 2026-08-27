"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  blockUserAction,
  reportUserAction,
  unblockUserAction,
  type ModerationState,
} from "@/app/actions/moderation";
import { REPORT_REASONS, REPORT_DETAILS_MAX } from "@/lib/validation/report";
import { useStickyForm } from "@/lib/hooks";

/**
 * The one moderation control on another member's profile, sitting where the
 * owner's own profile keeps "Edit Profile". A quiet pill opens a small menu;
 * reporting opens a modal (reason required, details optional) and blocking
 * asks once before it acts, because a block also hides their room from you.
 *
 * Nothing here decides anything: the report goes to a table whose trigger
 * applies the suspension rule, and the block is enforced by RLS in migrations
 * 0029/0030. The component only shows what already happened.
 */
export function ReportBlockMenu({
  memberId,
  memberName,
  blocked,
  reported,
}: {
  memberId: string;
  memberName: string;
  /** This viewer has blocked them (their own block, not the other direction). */
  blocked: boolean;
  /** This viewer already has a report on file for them. */
  reported: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | "report" | "block">(null);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const first = memberName.split(" ")[0] || memberName;

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

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="shrink-0 rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-danger hover:text-danger"
      >
        Report / Block
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={`Report or block ${first}`}
          className="absolute right-0 top-full z-20 mt-2 min-w-[15rem] overflow-hidden rounded-2xl border border-hairline bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]"
        >
          <button
            type="button"
            role="menuitem"
            disabled={reported}
            onClick={() => {
              setOpen(false);
              setModal("report");
            }}
            className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-paper hover:text-ink disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-muted"
          >
            {reported ? "Already reported" : `Report ${first}`}
          </button>
          {blocked ? (
            <UnblockItem memberId={memberId} first={first} onDone={() => setOpen(false)} />
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setModal("block");
              }}
              className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10"
            >
              Block {first}
            </button>
          )}
        </div>
      ) : null}

      {modal === "report" ? (
        <ReportModal memberId={memberId} first={first} onClose={() => setModal(null)} />
      ) : null}
      {modal === "block" ? (
        <BlockModal memberId={memberId} first={first} onClose={() => setModal(null)} />
      ) : null}
    </div>
  );
}

/** Undoing a block is not destructive, so it happens straight from the menu. */
function UnblockItem({ memberId, first, onDone }: { memberId: string; first: string; onDone: () => void }) {
  const router = useRouter();
  const [state, form, pending] = useStickyForm<ModerationState>(unblockUserAction, {});
  useEffect(() => {
    if (state.done) {
      onDone();
      router.refresh();
    }
  }, [state.done, onDone, router]);

  return (
    <form {...form}>
      <input type="hidden" name="blocked_id" value={memberId} />
      <button
        type="submit"
        role="menuitem"
        disabled={pending}
        className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left text-sm text-accent transition-colors hover:bg-paper disabled:opacity-60"
      >
        {pending ? "Unblocking…" : `Unblock ${first}`}
      </button>
    </form>
  );
}

/** The shell both modals sit in: scrim, centred card, Escape to close. */
function Modal({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative w-full max-w-lg rounded-t-[28px] border border-hairline bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-left shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5)] sm:rounded-[28px] sm:p-6"
      >
        {children}
      </div>
    </div>
  );
}

function ReportModal({ memberId, first, onClose }: { memberId: string; first: string; onClose: () => void }) {
  const router = useRouter();
  const [state, form, pending] = useStickyForm<ModerationState>(reportUserAction, {});
  const [reason, setReason] = useState("");
  const titleId = useId();

  useEffect(() => {
    if (state.done) router.refresh();
  }, [state.done, router]);

  if (state.done) {
    return (
      <Modal labelledBy={titleId} onClose={onClose}>
        <h2 id={titleId} className="text-xl font-semibold">
          Thanks — the report is with us
        </h2>
        <p className="mt-2 text-sm text-muted">
          We look at every report. You won&rsquo;t hear back about the outcome, but you can block {first} as well if
          you&rsquo;d rather not see them at all.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-xl font-semibold">
        Report {first}
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Tell us what happened. Reports are private — {first} is never told who reported them.
      </p>

      <form {...form} className="mt-4">
        <input type="hidden" name="reported_id" value={memberId} />

        <fieldset>
          <legend className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            Reason <span className="text-muted">(required)</span>
          </legend>
          <div className="mt-2.5 space-y-1.5">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.key}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  reason === r.key ? "border-accent bg-accent/5" : "border-hairline hover:border-accent/50"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.key}
                  checked={reason === r.key}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{r.label}</span>
                  <span className="block text-[13px] leading-5 text-muted">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            Details <span className="text-muted">(optional)</span>
          </span>
          <textarea
            name="details"
            rows={3}
            maxLength={REPORT_DETAILS_MAX}
            placeholder="Anything that helps us understand what happened."
            className="mt-2 w-full resize-none rounded-xl border border-hairline bg-paper px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
          />
        </label>

        {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !reason}
            className="rounded-full bg-danger px-5 py-2 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BlockModal({ memberId, first, onClose }: { memberId: string; first: string; onClose: () => void }) {
  const router = useRouter();
  const [state, form, pending] = useStickyForm<ModerationState>(blockUserAction, {});
  const titleId = useId();

  useEffect(() => {
    if (state.done) {
      onClose();
      router.refresh();
    }
  }, [state.done, onClose, router]);

  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-xl font-semibold">
        Block {first}?
      </h2>
      <p className="mt-2 text-sm text-muted">
        Neither of you will be able to message the other, and their room stops appearing in your Swipe, matches and
        Listings — as yours does for them. You can undo this any time under Settings.
      </p>
      {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}
      <form {...form} className="mt-5 flex items-center justify-end gap-2">
        <input type="hidden" name="blocked_id" value={memberId} />
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-danger px-5 py-2 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Blocking…" : `Block ${first}`}
        </button>
      </form>
    </Modal>
  );
}

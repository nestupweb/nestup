"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DAILY_LIFE_GAPS_NOTICE } from "@/lib/constants";

/**
 * "Saved — but your Daily life table is still short of answers", shown on Swipe
 * after a profile save (user, 2026-09-02).
 *
 * It is a warning, never a gate: the save already happened, the deck behind it
 * is fully usable, and "Not now" is a real answer. That is why it is dismissible
 * by every route out of a dialog — the button, Escape, the backdrop — and why
 * dismissing also drops `?saved=daily-life` from the URL, so a refresh or a
 * shared link does not put it back.
 *
 * Same shell as the Send Message sheet (`IntroDialog`): bottom sheet on a phone,
 * centred card from `sm:` up, one `max-w-lg` panel.
 */
export function DailyLifeReminder() {
  const [open, setOpen] = useState(true);

  const close = useCallback(() => {
    setOpen(false);
    // Drop the flag so this is a one-time message, not a property of the page.
    // `history.replaceState` rather than `router.replace`: the App Router's
    // replace left `?saved=daily-life` in the address bar here (verified on
    // prod — the modal closed and a refresh brought it straight back), and a
    // navigation is the wrong tool anyway for erasing a spent one-shot flag.
    try {
      window.history.replaceState(null, "", "/swipe");
    } catch {
      // Some embedded browsers refuse history writes. The modal is closed
      // either way; the worst case is that it returns on a manual refresh.
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        data-cursor="arrow"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-life-reminder-title"
        className="swipe-enter relative w-full max-w-lg rounded-t-[28px] border border-hairline bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5)] sm:rounded-[28px] sm:p-6"
      >
        <h2 id="daily-life-reminder-title" className="text-xl font-semibold leading-tight">
          Profile saved
        </h2>
        <p className="mt-3 text-sm leading-6 text-accent">{DAILY_LIFE_GAPS_NOTICE}</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {/* Same colour as the warning it sits under — an option, not a second CTA. */}
          <button
            type="button"
            onClick={close}
            className="rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-accent transition-colors hover:bg-accent/10"
          >
            Not now
          </button>
          <Link
            href="/profile/edit"
            className="rounded-full bg-accent px-5 py-2.5 text-center text-sm font-semibold uppercase tracking-wider text-accent-contrast"
          >
            Edit profile
          </Link>
        </div>
      </div>
    </div>
  );
}

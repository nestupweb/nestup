"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FINISH_APARTMENT_PREFS } from "@/lib/apartment-prefs";
import { NO_CITY_NOTICE } from "@/lib/constants";

/**
 * "Saved — but you won't be matched with anything until you name a city",
 * shown on Swipe after a profile save that left Preferred cities empty
 * (user, 2026-09-02).
 *
 * The stricter sibling of `DailyLifeReminder`, and deliberately the same shell:
 * one member should not have to learn two different sheets. What differs is
 * what it is warning about. An unfinished Daily life table costs match
 * *quality*; no city costs matches entirely, because the deck is filtered by
 * city before a single room is scored (`fitsHardFilters`). So the prompt names
 * the consequence in plain words rather than talking about preferences.
 *
 * Still not a gate. The profile saved, Browse still works, and "Not now" is a
 * real answer — so it closes on the button, on Escape and on the backdrop, and
 * closing drops `?needs=cities` from the URL so a refresh or a shared link
 * doesn't put it back. The gate behind it (`SwipeGate`) says the same thing
 * permanently, which is what a member who dismisses this comes back to.
 */
export function NoCityPrompt() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const close = useCallback(() => {
    setOpen(false);
    // Drop the flag so this is a one-time message, not a property of the page.
    router.replace("/swipe", { scroll: false });
  }, [router]);

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
        aria-labelledby="no-city-prompt-title"
        className="swipe-enter relative w-full max-w-lg rounded-t-[28px] border border-hairline bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5)] sm:rounded-[28px] sm:p-6"
      >
        <h2 id="no-city-prompt-title" className="text-xl font-semibold leading-tight">
          Profile saved
        </h2>
        <p className="mt-3 text-sm leading-6 text-accent">{NO_CITY_NOTICE}</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Add the cities you&rsquo;d live in and the deck opens straight away. Everything else in
          Apartment preferences stays optional.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {/* Same colour as the warning it sits under — an option, not a second CTA. */}
          <button
            type="button"
            onClick={close}
            className="rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-accent transition-colors hover:bg-accent/10"
          >
            Not now
          </button>
          {/* Straight to the form with the Apartment preferences banner showing,
              so the city field is named the moment they land rather than hunted for. */}
          <Link
            href={FINISH_APARTMENT_PREFS}
            className="rounded-full bg-accent px-5 py-2.5 text-center text-sm font-semibold uppercase tracking-wider text-accent-contrast"
          >
            Edit profile
          </Link>
        </div>
      </div>
    </div>
  );
}

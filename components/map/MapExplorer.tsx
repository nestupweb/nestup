"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ListingPin } from "@/lib/listings";

const ListingsMap = dynamic(() => import("@/components/map/ListingsMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

/**
 * The map, behind one button.
 *
 * The map used to replace the results list, which meant it took the page over
 * whenever it was on. Now it is a panel over the page (user decision,
 * 2026-08-28): a small square icon on the results line opens it, it never
 * fills the whole screen, and the way out is a labelled Close button — plus
 * Escape and a click on the backdrop, for people who expect those.
 *
 * What it shows is deliberately *everything*: every placed room on NestUp, not
 * the current filter. Pins are fetched the first time the map is opened and
 * kept for the rest of the visit.
 */
export function MapExplorer() {
  const [open, setOpen] = useState(false);
  const [pins, setPins] = useState<ListingPin[] | null>(null);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/listings/pins");
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { pins: ListingPin[] };
      setPins(body.pins);
    } catch {
      setFailed(true);
    }
  }, []);

  function show() {
    setOpen(true);
    if (!pins) void load();
  }

  const hide = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open the map of every room"
        title="Map"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-hairline bg-surface text-accent transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-accent/60 hover:shadow-[0_8px_18px_-12px_var(--accent)] focus:outline-none focus-visible:border-accent"
      >
        <MapGlyph />
      </button>

      {open ? <MapDialog pins={pins} failed={failed} onRetry={load} onClose={hide} /> : null}
    </>
  );
}

function MapDialog({
  pins,
  failed,
  onRetry,
  onClose,
}: {
  pins: ListingPin[] | null;
  failed: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Escape closes, Tab stays inside the panel, and the page behind stops
  // scrolling — the three things a dialog has to do to feel like one.
  useEffect(() => {
    closeButton.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-8">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/50 backdrop-blur-[2px]"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="map-open relative flex h-full max-h-[40rem] w-full max-w-[60rem] flex-col overflow-hidden rounded-3xl border border-hairline bg-surface shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold sm:text-lg">
              Every room on NestUp
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {pins === null ? (
                "Gathering the pins…"
              ) : (
                <>
                  {pins.length} room{pins.length === 1 ? "" : "s"} on the map
                  {/* Worth a line of its own, but not four of them on a
                      phone — there it would push the map down. */}
                  <span className="hidden sm:inline">
                    {" · "}each one is pinned at its address
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-paper py-1.5 pl-2.5 pr-3.5 text-[13px] font-medium leading-none text-ink transition-colors hover:border-accent/60 hover:text-accent focus:outline-none focus-visible:border-accent"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Close map
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          {failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted">The map couldn&rsquo;t load the rooms just now.</p>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-hairline px-4 py-1.5 text-sm font-medium text-accent transition-colors hover:border-accent"
              >
                Try again
              </button>
            </div>
          ) : pins === null ? (
            <MapSkeleton />
          ) : pins.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
              No rooms have a location yet.
            </div>
          ) : (
            <ListingsMap pins={pins} />
          )}
        </div>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-paper">
      <span className="flex items-center gap-2 text-sm text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        Drawing the map…
      </span>
    </div>
  );
}

/** A folded paper map. */
function MapGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M9 4 3.5 6.2v13.3L9 17.3l6 2.2 5.5-2.2V4L15 6.2 9 4Z" />
      <path d="M9 4v13.3M15 6.2v13.3" />
    </svg>
  );
}

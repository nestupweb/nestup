"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

/**
 * The map, behind one button — the shell both maps share.
 *
 * No map is drawn anywhere on load (user decision, 2026-08-28). A small square
 * icon is the only thing on the page; pressing it opens the map as a panel
 * over the page, never filling the screen, and the way out is a labelled Close
 * button plus Escape and a click on the backdrop.
 *
 * Two things use this: the Listings map of every room
 * (`components/map/MapExplorer.tsx`) and one room's own map
 * (`components/map/RoomMapButton.tsx`).
 */

/** The square icon that opens a map. Sized to sit on a row of controls. */
export function MapIconButton({
  onClick,
  label,
  open,
  buttonRef,
}: {
  onClick: () => void;
  /** What this map shows — read out to screen readers, and the hover title. */
  label: string;
  open: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label}
      title="Map"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-hairline bg-surface text-accent transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-accent/60 hover:shadow-[0_8px_18px_-12px_var(--accent)] focus:outline-none focus-visible:border-accent"
    >
      <MapGlyph />
    </button>
  );
}

export function MapDialog({
  title,
  subtitle,
  footer,
  onClose,
  children,
}: {
  title: string;
  /** One line under the title — the address, or how many rooms are shown. */
  subtitle: ReactNode;
  /** Below the map: the legend, on the room's map. */
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
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
            <h2 id={titleId} className="truncate text-base font-bold sm:text-lg">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-paper py-1.5 pl-2.5 pr-3.5 text-[13px] font-medium leading-none text-ink transition-colors hover:border-accent/60 hover:text-accent focus:outline-none focus-visible:border-accent"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Close map
          </button>
        </header>

        <div className="relative min-h-0 flex-1">{children}</div>

        {footer ? <div className="border-t border-hairline px-4 py-2.5 sm:px-5">{footer}</div> : null}
      </div>
    </div>
  );
}

export function MapSkeleton() {
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="M9 4 3.5 6.2v13.3L9 17.3l6 2.2 5.5-2.2V4L15 6.2 9 4Z" />
      <path d="M9 4v13.3M15 6.2v13.3" />
    </svg>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LISTING_SORTS, type ListingSort } from "@/lib/validation/filters";

/**
 * Browse ordering — a quiet pill ("Sort · Newest") that opens a small menu.
 * Writes `?sort=` into the URL (the server re-queries) and resets to page 1;
 * every other filter is kept. Sits on the results line, opposite the count.
 */
export function SortMenu({ value }: { value: ListingSort }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = LISTING_SORTS.find((s) => s.key === value) ?? LISTING_SORTS[0];

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

  function choose(key: ListingSort) {
    setOpen(false);
    if (key === value) return;
    const next = new URLSearchParams(params.toString());
    if (key === "newest") next.delete("sort");
    else next.set("sort", key);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/browse?${qs}` : "/browse");
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-label={`Sort: ${current.label}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface py-1.5 pl-3.5 pr-3 text-[13px] leading-none text-ink transition-colors hover:border-accent/60 focus:outline-none focus-visible:border-accent"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-accent" aria-hidden="true">
          <path d="M4 7h11M4 12h7M4 17h4M18 5v14M15 16l3 3 3-3" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Sort</span>
        <span className="font-medium">{current.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Sort rooms"
          className="absolute right-0 top-full z-20 mt-2 min-w-[12.5rem] overflow-hidden rounded-2xl border border-hairline bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]"
        >
          {LISTING_SORTS.map((s) => {
            const active = s.key === value;
            return (
              <button
                key={s.key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(s.key)}
                className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-paper ${
                  active ? "font-semibold text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {s.label}
                {active ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-accent" aria-hidden="true">
                    <path d="M5 12l4 4L19 7" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

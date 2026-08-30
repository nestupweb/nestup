"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Keep this much clear of the viewport edges. */
const GUTTER = 12;
/** The floating bottom nav paints over the popover, so leave it this strip. */
const NAV_SAFE = 88;
/** Narrowest the month grid stays readable, and the design width (19rem). */
const MIN_W = 224;
const MAX_W = 304;

// useLayoutEffect warns when rendered on the server; the popover only ever
// measures itself on the client, so fall back to useEffect there.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function toISODate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}
export function parseISODate(iso: string | undefined | null): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}
export function todayISO(now = new Date()): string {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
/** "Wed, 1 Oct 2026" */
export function formatISODate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }): string {
  const p = parseISODate(iso);
  if (!p) return "";
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString("en-GB", opts);
}

/** "01/10/2026" — an ISO date in the form people type it. */
export function toDMY(iso: string): string {
  const p = parseISODate(iso);
  return p ? `${pad(p.d)}/${pad(p.m)}/${p.y}` : "";
}

/**
 * Parse a typed dd/mm/yyyy into an ISO date, or null if it isn't a real date.
 *
 * Strict on purpose. `new Date(2011, 12, 45)` happily rolls forward into 2012,
 * so the month is range-checked and the day is checked against that month's
 * real length: 45/13/2011, 31/04/2026 and 29/02/2025 are all rejected, while
 * 29/02/2024 (a leap year) is accepted. Single-digit day and month are fine.
 */
export function parseDMY(input: string): string | null {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/.exec(input);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || y < 1900 || y > 2199) return null;
  const daysInMonth = new Date(y, mo, 0).getDate(); // day 0 of the next month
  if (d < 1 || d > daysInMonth) return null;
  return toISODate(y, mo, d);
}

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string; // controlled ISO date
  defaultValue?: string;
  onChange?: (iso: string) => void;
  min?: string;
  max?: string;
  /** Only these weekdays (0 = Sunday) are selectable; null/undefined = all. */
  allowedWeekdays?: number[] | null;
  placeholder?: string;
  /** Render the calendar itself, always open, instead of a field with a popover. */
  inline?: boolean;
  clearable?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * The site's date picker — a field that opens a small month calendar in the
 * app's palette (or the calendar inline). Submits the ISO date through a
 * hidden input; the server validates as before.
 */
export function DatePicker({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  allowedWeekdays,
  placeholder = "Pick a date",
  inline = false,
  clearable = false,
  className = "",
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const selected = controlled ? value : inner;
  const [open, setOpen] = useState(false);
  // Popover is position: fixed so scrolling panels (filters sidebar, sheets) can't clip it.
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const fieldId = id ?? `date-${autoId}`;

  const today = todayISO();
  const initial = parseISODate(selected) ?? parseISODate(min) ?? parseISODate(today)!;
  const [view, setView] = useState({ y: initial.y, m: initial.m });

  // Jump to the selected month when the value changes (state adjusted during render).
  const [seen, setSeen] = useState(selected);
  if (seen !== selected) {
    setSeen(selected);
    const p = parseISODate(selected);
    if (p) setView({ y: p.y, m: p.m });
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const pick = (iso: string) => {
    if (!controlled) setInner(iso);
    onChange?.(iso);
    if (!inline) setOpen(false);
  };

  const isBlocked = (iso: string, weekday: number) =>
    (min ? iso < min : false) ||
    (max ? iso > max : false) ||
    (allowedWeekdays ? !allowedWeekdays.includes(weekday) : false);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m - 1, 1);
    const lead = first.getDay(); // Sunday-first grid
    const count = new Date(view.y, view.m, 0).getDate();
    const out: Array<{ iso: string; d: number; weekday: number } | null> = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= count; d++) out.push({ iso: toISODate(view.y, view.m, d), d, weekday: (lead + d - 1) % 7 });
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const monthLabel = new Date(view.y, view.m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const step = (delta: number) => {
    const d = new Date(view.y, view.m - 1 + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() + 1 });
  };
  const canPrev = !min || toISODate(view.y, view.m, 1) > min.slice(0, 7) + "-01";
  const canMax = !max || toISODate(view.y, view.m, 1) < max.slice(0, 7) + "-01";

  const calendar = (
    <div
      role={inline ? undefined : "dialog"}
      aria-label={inline ? undefined : "Choose a date"}
      style={inline ? undefined : pos}
      className={`font-normal normal-case tracking-normal text-ink ${
        inline
          ? "w-full"
          : "fixed z-[70] w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-hairline bg-surface p-3 shadow-xl"
      }`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canPrev}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
        >
          <Chevron dir="left" />
        </button>
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink" aria-live="polite">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canMax}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {cells.map((c, i) =>
          c ? (
            <DayCell
              key={c.iso}
              iso={c.iso}
              day={c.d}
              selected={c.iso === selected}
              today={c.iso === today}
              blocked={isBlocked(c.iso, c.weekday)}
              onPick={pick}
            />
          ) : (
            <span key={`blank-${i}`} />
          )
        )}
      </div>

      {(clearable && selected) || !inline ? (
        <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-[12px]">
          {!inline && !isBlocked(today, new Date().getDay()) ? (
            <button type="button" onClick={() => pick(today)} className="font-semibold text-accent hover:underline">
              Today
            </button>
          ) : (
            <span />
          )}
          {clearable && selected ? (
            <button type="button" onClick={() => pick("")} className="text-muted hover:text-ink">
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (inline) {
    return (
      <div ref={wrapRef} className={className}>
        {name ? <input type="hidden" name={name} value={selected} /> : null}
        {calendar}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <button
        type="button"
        id={fieldId}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          const r = wrapRef.current?.getBoundingClientRect();
          if (r) {
            const W = 19 * 16;
            const H = 340;
            const next: typeof pos = {};
            if (r.left + W > window.innerWidth - 12) next.right = Math.max(12, window.innerWidth - r.right);
            else next.left = r.left;
            if (r.bottom + 8 + H > window.innerHeight && r.top > H + 8) next.bottom = window.innerHeight - r.top + 8;
            else next.top = r.bottom + 8;
            setPos(next);
          }
          setOpen((o) => !o);
        }}
        className={`mt-1 flex w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2.5 text-left text-sm outline-none transition-colors ${
          open ? "border-accent" : "border-hairline hover:border-accent/60"
        } ${selected ? "text-ink" : "text-muted"}`}
      >
        <span className="truncate normal-case tracking-normal">{selected ? formatISODate(selected) : placeholder}</span>
        <CalendarGlyph />
      </button>
      {open ? calendar : null}
    </div>
  );
}

function DayCell({
  iso,
  day,
  selected,
  today,
  blocked,
  onPick,
}: {
  iso: string;
  day: number;
  selected: boolean;
  today: boolean;
  blocked: boolean;
  onPick: (iso: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={blocked}
      aria-label={formatISODate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      aria-pressed={selected}
      onClick={() => onPick(iso)}
      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
        selected
          ? "bg-accent font-semibold text-accent-contrast"
          : blocked
            ? "text-muted/35 line-through decoration-transparent"
            : "text-ink hover:bg-accent/10 hover:text-accent"
      } ${today && !selected ? "ring-1 ring-accent" : ""}`}
    >
      {day}
    </button>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

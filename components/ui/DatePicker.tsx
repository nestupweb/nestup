"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Keep this much clear of the viewport edges. */
const GUTTER = 12;
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
/**
 * Shape a dd/mm/yyyy field while it is being typed.
 *
 * The separators appear on their own: two digits close the day, two more close
 * the month, so 1-2-7 reads as `12/7` without the "/" key and the month can
 * never take a third digit — a third keypress starts the year instead. A slash
 * may still be typed by hand to close a single-digit day or month (`1/7/2026`).
 *
 * `previous` is the value before this keystroke. While deleting, the string is
 * left alone apart from stripping stray characters — otherwise backspacing over
 * an auto-inserted "/" would put it straight back and trap the caret.
 */
export function maskDMY(raw: string, previous = ""): string {
  const cleaned = raw.replace(/[^\d/]/g, "").replace(/\/{2,}/g, "/").slice(0, 10);
  if (raw.length < previous.length) return cleaned;

  const caps = [2, 2, 4];
  const parts: string[] = [];
  let cur = "";
  for (const ch of cleaned) {
    if (ch === "/") {
      if (cur === "" || parts.length >= 2) continue; // leading, doubled, or past the year
      parts.push(cur);
      cur = "";
      continue;
    }
    if (parts.length >= 3 || (parts.length === 2 && cur.length >= caps[2])) break;
    cur += ch;
    if (parts.length < 2 && cur.length === caps[parts.length]) {
      parts.push(cur);
      cur = "";
    }
  }

  const out = (cur ? [...parts, cur] : parts).join("/");
  // Show the separator the moment a section closes, so the next digit is
  // visibly landing in the next box.
  return cur === "" && parts.length > 0 && parts.length < 3 ? `${out}/` : out;
}

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
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; width?: number }>({});
  const [placed, setPlaced] = useState(false);
  // What the member types into the dd/mm/yyyy box, and why it was refused.
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
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

  /**
   * Place the popover once it has rendered, by measuring rather than guessing.
   *
   * It used to be a fixed 19rem opened at the field's left edge. In the
   * Listings filters that column is only ~15rem wide, so the calendar spilled
   * out of it and ran under the listing photos — the cards paint over it and
   * the last weekday column became unreadable. It is now capped to the width of
   * the column it belongs to (the nearest form/fieldset), so it opens beside
   * the results instead of on top of them, and its real height decides whether
   * it drops below the field or flips above it.
   */
  useIsoLayoutEffect(() => {
    if (inline || !open) {
      setPlaced(false);
      return;
    }
    const wrap = wrapRef.current;
    const pop = popRef.current;
    if (!wrap || !pop) return;

    const r = wrap.getBoundingClientRect();
    const column = (wrap.closest("form, fieldset") as HTMLElement | null)?.getBoundingClientRect();
    const leftLimit = Math.max(GUTTER, column ? column.left : GUTTER);
    const rightLimit = Math.min(window.innerWidth - GUTTER, column ? column.right : window.innerWidth - GUTTER);

    const width = Math.round(Math.max(MIN_W, Math.min(MAX_W, rightLimit - leftLimit)));
    const left = Math.max(leftLimit, Math.min(r.left, rightLimit - width));

    // The day cells are fluid, so height follows the width we just chose:
    // apply it before measuring instead of estimating a constant.
    pop.style.width = `${width}px`;
    const h = pop.offsetHeight;

    // Drop below the field whenever it fits, otherwise take the roomier side —
    // flipping up in a narrow sidebar hides the filters above it, so it is the
    // fallback rather than the first choice. (The floating nav is z-40 and the
    // popover z-70, so there is no need to keep clear of it.)
    const spaceBelow = window.innerHeight - GUTTER - (r.bottom + 8);
    const spaceAbove = r.top - 8 - GUTTER;
    const next: typeof pos = { left, width };
    if (h <= spaceBelow || spaceBelow >= spaceAbove) {
      next.top = Math.max(GUTTER, Math.min(r.bottom + 8, window.innerHeight - GUTTER - h));
    } else {
      next.bottom = window.innerHeight - r.top + 8;
    }

    setPos(next);
    setPlaced(true);
  }, [open, inline]);

  const pick = (iso: string) => {
    if (!controlled) setInner(iso);
    onChange?.(iso);
    if (!inline) setOpen(false);
  };

  /**
   * Take what was typed into the dd/mm/yyyy box. `close` is true for Enter —
   * mid-typing we only fill the value in so the month jumps and the day
   * highlights, leaving the calendar open.
   */
  const commitTyped = (raw: string, close: boolean) => {
    const s = raw.trim();
    if (!s) {
      setTypedError("");
      return;
    }
    const iso = parseDMY(s);
    if (!iso) {
      setTypedError("Not a real date — use dd/mm/yyyy");
      return;
    }
    const p = parseISODate(iso)!;
    if (isBlocked(iso, new Date(p.y, p.m - 1, p.d).getDay())) {
      setTypedError("That date can't be picked here");
      return;
    }
    setTypedError("");
    setView({ y: p.y, m: p.m });
    if (close) {
      pick(iso);
      return;
    }
    if (!controlled) setInner(iso);
    onChange?.(iso);
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
      ref={inline ? undefined : popRef}
      role={inline ? undefined : "dialog"}
      aria-label={inline ? undefined : "Choose a date"}
      style={inline ? undefined : pos}
      className={`font-normal normal-case tracking-normal text-ink ${
        inline
          ? "w-full"
          : `fixed z-[70] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-hairline bg-surface p-3 shadow-xl ${
              placed ? "" : "pointer-events-none opacity-0"
            }`
      }`}
    >
      {!inline ? (
        <div className="mb-2.5">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            placeholder="dd/mm/yyyy"
            aria-label="Type a date as dd/mm/yyyy"
            aria-invalid={typedError ? true : undefined}
            aria-describedby={typedError ? `${fieldId}-typed-error` : undefined}
            maxLength={10}
            onChange={(e) => {
              const v = maskDMY(e.target.value, typed);
              setTyped(v);
              setTypedError("");
              // Only judge it once it is a whole date, so half-typed input isn't scolded.
              if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) commitTyped(v, false);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault(); // never submit the surrounding filter/profile form
              commitTyped(typed, true);
            }}
            className={`w-full rounded-xl border bg-surface px-3 py-1.5 text-sm tabular-nums text-ink outline-none transition-colors placeholder:text-muted ${
              typedError ? "border-danger" : "border-hairline focus:border-accent"
            }`}
          />
          {typedError ? (
            <p id={`${fieldId}-typed-error`} role="alert" className="mt-1 text-[11px] text-danger">
              {typedError}
            </p>
          ) : null}
        </div>
      ) : null}

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

      <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-0.5">
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
        <div className="mt-1.5 flex items-center justify-between border-t border-hairline pt-1.5 text-[12px]">
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
          const next = !open;
          if (next) {
            // Start the typing box on whatever is already chosen.
            setTyped(toDMY(selected));
            setTypedError("");
          }
          setOpen(next);
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
      className={`mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
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

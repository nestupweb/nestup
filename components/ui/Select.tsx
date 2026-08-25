import type { SelectHTMLAttributes } from "react";
import { fromMinutes, toMinutes } from "@/lib/availability";

const field =
  "w-full appearance-none rounded-xl border border-hairline bg-surface py-2.5 pl-3 pr-9 text-sm text-ink outline-none transition-colors hover:border-accent/60 focus:border-accent";

/** A native <select> dressed in the app's field style, with its own chevron. */
export function Select({
  className = "mt-1",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) {
  return (
    <span className={`relative block ${className}`}>
      <select {...rest} className={field}>
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

export function timeOptions(from = "00:00", to = "23:45", step = 15): string[] {
  const a = toMinutes(from) ?? 0;
  const b = toMinutes(to) ?? 23 * 60 + 45;
  const out: string[] = [];
  for (let t = a; t <= b; t += step) out.push(fromMinutes(t));
  return out;
}

/** Time-of-day picker (HH:MM) on a step grid; optionally with an empty choice. */
export function TimeSelect({
  from,
  to,
  step = 15,
  options,
  allowEmpty = false,
  emptyLabel = "—",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  from?: string;
  to?: string;
  step?: number;
  options?: string[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const list = options ?? timeOptions(from, to, step);
  return (
    <Select {...rest}>
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {list.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </Select>
  );
}

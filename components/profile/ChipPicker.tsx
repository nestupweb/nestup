"use client";

import { useState } from "react";

/**
 * Multi-select as chips: one hidden checkbox per option under `name`, so the
 * picker submits with any form. `max` caps the selection (extra taps are
 * ignored); the legend shows the running count.
 */
export function ChipPicker({
  name,
  options,
  initial,
  max,
  legend,
}: {
  name: string;
  options: readonly string[];
  initial: string[];
  max?: number;
  legend: string;
}) {
  const cap = max ?? options.length;
  const [selected, setSelected] = useState<string[]>(initial);

  function toggle(tag: string) {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length >= cap ? prev : [...prev, tag]
    );
  }

  return (
    <fieldset>
      <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {legend} <span className="normal-case tracking-normal">· {selected.length} selected</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((tag) => {
          const on = selected.includes(tag);
          return (
            <label
              key={tag}
              className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                on ? "border-accent bg-accent text-accent-contrast" : "border-hairline bg-surface text-muted hover:border-accent/60 hover:text-ink"
              }`}
            >
              <input type="checkbox" name={name} value={tag} checked={on} onChange={() => toggle(tag)} className="sr-only" />
              {tag}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

"use client";

import { useState } from "react";
import { INTERESTS, MAX_INTERESTS, MIN_INTERESTS } from "@/lib/constants";

export function InterestsPicker({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);

  function toggle(tag: string) {
    setSelected((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= MAX_INTERESTS
          ? prev
          : [...prev, tag]
    );
  }

  return (
    <fieldset>
      <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Pick {MIN_INTERESTS}–{MAX_INTERESTS} <span className="normal-case tracking-normal">· {selected.length} selected</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {INTERESTS.map((tag) => {
          const on = selected.includes(tag);
          return (
            <label
              key={tag}
              className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                on ? "border-accent bg-accent text-accent-contrast" : "border-hairline bg-surface text-muted hover:border-accent/60 hover:text-ink"
              }`}
            >
              <input
                type="checkbox"
                name="interests"
                value={tag}
                checked={on}
                onChange={() => toggle(tag)}
                className="sr-only"
              />
              {tag}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

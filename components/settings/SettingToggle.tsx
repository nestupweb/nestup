"use client";

import { useState, useTransition } from "react";

/**
 * One switch row on the Settings page: label, optional hint, and a pill track
 * whose knob slides across (the same visual language as the header's
 * ThemeToggle). The flip is optimistic — the switch moves at once, and if the
 * server says no it moves back and the reason appears under the row. There is
 * no "Saved." line anywhere: a switch that stayed flipped is the confirmation.
 */
export function SettingToggle({
  label,
  hint,
  checked,
  onSave,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onSave: (value: boolean) => Promise<{ error?: string }>;
}) {
  const [on, setOn] = useState(checked);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError("");
    start(async () => {
      const result = await onSave(next);
      if (result?.error) {
        setOn(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div className="border-t border-hairline py-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{label}</p>
          {hint ? <p className="mt-0.5 text-[13px] leading-5 text-muted">{hint}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={pending}
          onClick={toggle}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-60 ${
            on ? "border-accent bg-accent" : "border-hairline bg-surface"
          }`}
        >
          <span
            className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
              on ? "left-6 bg-accent-contrast" : "left-1 bg-muted"
            }`}
          />
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { BUDGET_CAP, BUDGET_STEP } from "@/lib/constants";

const shekels = (n: number) => `₪${n.toLocaleString("en-US")}`;

/** "Any budget", "Up to ₪4,500 / month", "₪2,000 – ₪4,500 / month"… (max 0 = no max). */
export function budgetSummary(min: number, max: number): string {
  if (min <= 0 && max <= 0) return "Any budget";
  if (max <= 0) return `From ${shekels(min)} / month`;
  if (min <= 0) return `Up to ${shekels(max)} / month`;
  return `${shekels(min)} – ${shekels(max)} / month`;
}

const snap = (n: number) => Math.min(BUDGET_CAP, Math.max(0, Math.round(n / BUDGET_STEP) * BUDGET_STEP));

/**
 * Two handles on one track: the left one is the least I'd pay, the right one
 * the most. Parking the right handle at the far end means "no maximum" and
 * submits 0, which the scores read as "budget not set".
 */
export function BudgetRange({ initialMin = 0, initialMax = 0 }: { initialMin?: number; initialMax?: number }) {
  const [min, setMin] = useState(() => snap(initialMin));
  const [maxPos, setMaxPos] = useState(() => (initialMax > 0 ? Math.max(snap(initialMax), snap(initialMin) + BUDGET_STEP) : BUDGET_CAP));
  const submitMax = maxPos >= BUDGET_CAP ? 0 : maxPos;
  const left = (min / BUDGET_CAP) * 100;
  const right = (maxPos / BUDGET_CAP) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-lg font-semibold text-ink" aria-live="polite">
          {budgetSummary(min, submitMax)}
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">per month</p>
      </div>

      <div className="relative mt-3 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-hairline" aria-hidden="true" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${left}%`, right: `${100 - right}%` }}
          aria-hidden="true"
        />
        <input
          type="range"
          min={0}
          max={BUDGET_CAP}
          step={BUDGET_STEP}
          value={min}
          onChange={(e) => setMin(Math.min(Number(e.target.value), maxPos - BUDGET_STEP))}
          aria-label="Minimum budget"
          aria-valuetext={min > 0 ? `${shekels(min)} per month` : "No minimum"}
          className="dual-range absolute inset-0 h-6 w-full"
          style={{ zIndex: min > BUDGET_CAP - BUDGET_STEP * 4 ? 3 : 2 }}
        />
        <input
          type="range"
          min={0}
          max={BUDGET_CAP}
          step={BUDGET_STEP}
          value={maxPos}
          onChange={(e) => setMaxPos(Math.max(Number(e.target.value), min + BUDGET_STEP))}
          aria-label="Maximum budget"
          aria-valuetext={maxPos >= BUDGET_CAP ? "No maximum" : `${shekels(maxPos)} per month`}
          className="dual-range absolute inset-0 h-6 w-full"
          style={{ zIndex: 2 }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden="true">
        <span>₪0</span>
        <span>{shekels(BUDGET_CAP)}+</span>
      </div>

      <input type="hidden" name="budget_min" value={min} />
      <input type="hidden" name="budget_max" value={submitMax} />
    </div>
  );
}

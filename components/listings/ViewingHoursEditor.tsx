"use client";

import { useState } from "react";
import { Select, TimeSelect } from "@/components/ui/Select";
import { DAY_LONG, MAX_VIEWING_SLOTS, normalizeSlots, toMinutes, type ViewingSlot } from "@/lib/availability";

const label = "block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted";

/**
 * Weekly viewing hours on the listing form. Rows of day + from + to; the form
 * submits them as one JSON field (`viewing_slots`). Seekers can then only
 * request viewings inside these windows.
 */
export function ViewingHoursEditor({ initial }: { initial: ViewingSlot[] }) {
  const [rows, setRows] = useState<ViewingSlot[]>(initial);

  const update = (i: number, patch: Partial<ViewingSlot>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));
  const add = () =>
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const day = last ? (last.day + 1) % 7 : 0;
      return [...prev, { day, from: last?.from ?? "17:00", to: last?.to ?? "20:00" }];
    });

  const invalid = rows.some((r) => (toMinutes(r.to) ?? 0) <= (toMinutes(r.from) ?? 0));

  return (
    <div>
      <input type="hidden" name="viewing_slots" value={JSON.stringify(normalizeSlots(rows))} />
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No viewing hours yet — seekers can suggest any time, and you approve each request.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
              <label className={`${label} col-span-2 sm:col-span-1`}>
                Day
                <Select value={r.day} onChange={(e) => update(i, { day: Number(e.target.value) })} aria-label={`Day ${i + 1}`}>
                  {DAY_LONG.map((d, idx) => (
                    <option key={d} value={idx}>
                      {d}
                    </option>
                  ))}
                </Select>
              </label>
              <label className={label}>
                From
                <TimeSelect from="06:00" to="23:00" step={30} value={r.from} onChange={(e) => update(i, { from: e.target.value })} aria-label={`From ${i + 1}`} />
              </label>
              <span className="flex items-end gap-2">
                <label className={`${label} flex-1`}>
                  To
                  <TimeSelect from="06:30" to="23:30" step={30} value={r.to} onChange={(e) => update(i, { to: e.target.value })} aria-label={`To ${i + 1}`} />
                </label>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove hours ${i + 1}`}
                  className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-danger hover:text-danger"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {invalid ? <p role="alert" className="mt-2 text-sm text-danger">Each range must end after it starts.</p> : null}
      {rows.length < MAX_VIEWING_SLOTS ? (
        <button
          type="button"
          onClick={add}
          className="mt-3 rounded-full border border-hairline px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-ink transition-colors hover:border-accent hover:text-accent"
        >
          + Add hours
        </button>
      ) : null}
    </div>
  );
}

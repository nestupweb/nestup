import { dailyLifeRows } from "@/lib/daily-life";
import type { Profile } from "@/lib/types";

const head = "text-[11px] font-bold uppercase tracking-[0.18em] text-accent";
/** Phones: the two answer columns; wider: the habit name gets its own first column. */
export const dailyLifeCols = "grid grid-cols-2 gap-x-3 sm:grid-cols-[9rem_1fr_1fr] sm:gap-x-4";

/** The header row: nothing above the habit column, then the two answer columns. */
export function DailyLifeHead({ cols = dailyLifeCols, className = "" }: { cols?: string; className?: string }) {
  return (
    <div role="row" className={`${cols} items-end ${className}`}>
      <span role="columnheader" aria-label="Habit" className="hidden sm:block" />
      <span role="columnheader" className={head}>My lifestyle</span>
      <span role="columnheader" className={head}>What I want in roommates</span>
    </div>
  );
}

/** The Daily life table, read-only: how they live beside what they want in roommates. */
export function DailyLifeView({ profile }: { profile: Profile }) {
  return (
    <div role="table" aria-label="Daily life">
      <DailyLifeHead className="border-b border-hairline pb-2.5" />
      {dailyLifeRows(profile).map((r) => (
        <div
          key={r.key}
          role="row"
          className={`${dailyLifeCols} gap-y-1 border-b border-hairline py-3 last:border-b-0 sm:items-baseline`}
        >
          <p role="rowheader" className="col-span-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted sm:col-span-1 sm:text-[13px] sm:normal-case sm:tracking-normal sm:text-ink">
            {r.label}
          </p>
          <p role="cell" className="text-sm text-ink">{r.mine}</p>
          <p role="cell" className="text-sm text-ink">{r.wants}</p>
        </div>
      ))}
    </div>
  );
}

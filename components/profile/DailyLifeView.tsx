import { dailyLifeRows } from "@/lib/daily-life";
import type { Profile } from "@/lib/types";

const head = "text-[11px] font-bold uppercase tracking-[0.18em] text-accent";
const cols = "sm:grid-cols-[9rem_1fr_1fr]";

/** The Daily life table, read-only: how they live beside what they want in flatmates. */
export function DailyLifeView({ profile }: { profile: Profile }) {
  return (
    <div role="table" aria-label="Daily life" className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div role="row" className={`hidden gap-4 border-b border-hairline px-5 py-3 sm:grid ${cols}`}>
        <span role="columnheader" className="sr-only">Habit</span>
        <span role="columnheader" className={head}>My lifestyle</span>
        <span role="columnheader" className={head}>What I want in flatmates</span>
      </div>
      {dailyLifeRows(profile).map((r) => (
        <div
          key={r.key}
          role="row"
          className={`grid grid-cols-2 gap-x-4 gap-y-1 border-b border-hairline px-4 py-3 last:border-b-0 sm:gap-4 sm:px-5 ${cols} sm:items-baseline`}
        >
          <p role="rowheader" className="col-span-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted sm:col-span-1 sm:text-[13px] sm:normal-case sm:tracking-normal sm:text-ink">
            {r.label}
          </p>
          <p role="cell" className="text-sm text-ink">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted sm:hidden">Me</span>
            {r.mine}
          </p>
          <p role="cell" className="text-sm text-ink">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted sm:hidden">Flatmates</span>
            {r.wants}
          </p>
        </div>
      ))}
    </div>
  );
}

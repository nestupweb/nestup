import type { ReactNode } from "react";
import { DailyLifeHead } from "@/components/profile/DailyLifeView";
import { Select } from "@/components/ui/Select";
import {
  CLEANLINESS_LEVELS,
  DIETS,
  GUEST_FREQS,
  NOISE_LEVELS,
  PREF_CLEANLINESS,
  PREF_DIET,
  PREF_GUESTS,
  PREF_NOISE,
  PREF_SHABBAT,
  PREF_SLEEP,
  SHABBAT_LEVELS,
  SLEEP_SCHEDULES,
} from "@/lib/constants";
import type { Profile } from "@/lib/types";

/** Phones: the two answer columns; wider: the habit name gets its own first column. */
const cols = "grid grid-cols-2 gap-x-3 sm:grid-cols-[8.5rem_1fr_1fr] sm:gap-x-4";

function Row({ label, mine, wants }: { label: string; mine: ReactNode; wants: ReactNode }) {
  return (
    <div role="row" className={`${cols} gap-y-1.5 border-t border-hairline py-3 sm:items-center sm:py-2.5`}>
      <p role="rowheader" className="col-span-2 text-[13px] font-semibold text-ink sm:col-span-1">{label}</p>
      <div role="cell">{mine}</div>
      <div role="cell">{wants}</div>
    </div>
  );
}

function Choice<K extends string | number>({
  name,
  value,
  options,
}: {
  name: string;
  value: K;
  options: readonly { key: K; label: string }[];
}) {
  return (
    <Select name={name} defaultValue={value} className="">
      {options.map((o) => (
        <option key={String(o.key)} value={o.key}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** Yes/no as a select: "on" is what the action reads as checked. */
function YesNo({ name, checked, yes, no }: { name: string; checked: boolean; yes: string; no: string }) {
  return (
    <Select name={name} defaultValue={checked ? "on" : ""} className="">
      <option value="">{no}</option>
      <option value="on">{yes}</option>
    </Select>
  );
}

/**
 * Daily life as a two-column table: how I live beside what I want in
 * roommates, one row per habit. Every cell is a plain form control, so the
 * table submits with the profile form; the scores in lib/compatibility.ts
 * read both columns.
 */
export function DailyLifeFields({ profile: p }: { profile: Profile | null }) {
  return (
    <div role="table" aria-label="Daily life" className="rounded-2xl border border-hairline bg-surface px-4 pb-1 pt-3 sm:px-5">
      <DailyLifeHead cols={cols} className="pb-2.5" />

      <Row
        label="Smoking"
        mine={<YesNo name="smoker" checked={p?.smoker ?? false} yes="I smoke" no="I don't smoke" />}
        wants={<YesNo name="ok_with_smoker" checked={p?.ok_with_smoker ?? true} yes="Fine with a smoker" no="Non-smokers only" />}
      />
      <Row
        label="Pets"
        mine={<YesNo name="has_pet" checked={p?.has_pet ?? false} yes="I have a pet" no="No pets" />}
        wants={<YesNo name="ok_with_pets" checked={p?.ok_with_pets ?? true} yes="Pets welcome" no="No pets, please" />}
      />
      <Row
        label="Cleanliness"
        mine={<Choice name="cleanliness" value={p?.cleanliness ?? 3} options={CLEANLINESS_LEVELS} />}
        wants={<Choice name="pref_cleanliness" value={p?.pref_cleanliness ?? 1} options={PREF_CLEANLINESS} />}
      />
      <Row
        label="Schedule"
        mine={<Choice name="sleep_schedule" value={p?.sleep_schedule ?? "flexible"} options={SLEEP_SCHEDULES} />}
        wants={<Choice name="pref_sleep" value={p?.pref_sleep ?? "any"} options={PREF_SLEEP} />}
      />
      <Row
        label="Guests"
        mine={<Choice name="guests_freq" value={p?.guests_freq ?? "sometimes"} options={GUEST_FREQS} />}
        wants={<Choice name="pref_guests" value={p?.pref_guests ?? "any"} options={PREF_GUESTS} />}
      />
      <Row
        label="Noise"
        mine={<Choice name="noise_level" value={p?.noise_level ?? "moderate"} options={NOISE_LEVELS} />}
        wants={<Choice name="pref_noise" value={p?.pref_noise ?? "any"} options={PREF_NOISE} />}
      />
      <Row
        label="Dietary restrictions"
        mine={<Choice name="dietary" value={p?.diet ?? "none"} options={DIETS} />}
        wants={<Choice name="pref_diet" value={p?.pref_diet ?? "any"} options={PREF_DIET} />}
      />
      <Row
        label="Shabbat"
        mine={<Choice name="shabbat" value={p?.shabbat ?? ""} options={SHABBAT_LEVELS} />}
        wants={<Choice name="pref_shabbat" value={p?.pref_shabbat ?? "any"} options={PREF_SHABBAT} />}
      />
    </div>
  );
}

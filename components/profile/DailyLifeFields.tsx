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
import { PREFER_NOT_TO_SAY } from "@/lib/validation/profile";
import type { Profile } from "@/lib/types";

/** Phones: the two answer columns; wider: the habit name gets its own first column. */
const cols = "grid grid-cols-2 gap-x-3 sm:grid-cols-[8.5rem_1fr_1fr] sm:gap-x-4";

/** The blank every cell opens on. Its value is "" — the schema reads that as null. */
const UNANSWERED_LABEL = "— Not answered";

function Row({ label, mine, wants }: { label: string; mine: ReactNode; wants: ReactNode }) {
  return (
    <div role="row" className={`${cols} gap-y-1.5 border-t border-hairline py-3 sm:items-center sm:py-2.5`}>
      <p role="rowheader" className="col-span-2 text-[13px] font-semibold text-ink sm:col-span-1">{label}</p>
      <div role="cell">{mine}</div>
      <div role="cell">{wants}</div>
    </div>
  );
}

/**
 * One cell. Every select opens on a blank, so a member who has never answered
 * sees an empty table rather than answers the database picked for them (0035).
 */
function Choice<K extends string | number>({
  name,
  value,
  options,
}: {
  name: string;
  value: K | null;
  options: readonly { key: K; label: string }[];
}) {
  return (
    <Select name={name} defaultValue={value === null ? "" : String(value)} className="">
      <option value="">{UNANSWERED_LABEL}</option>
      {options.map((o) => (
        <option key={String(o.key)} value={o.key}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Yes/no as a select. "yes" and "no" are both real answers and both stored, so
 * neither may share the blank's value — reading a blank as No was exactly the
 * bug: a member who never opened the form was recorded as a non-smoker who
 * welcomes pets.
 */
function YesNo({ name, checked, yes, no }: { name: string; checked: boolean | null; yes: string; no: string }) {
  return (
    <Select name={name} defaultValue={checked === null ? "" : checked ? "yes" : "no"} className="">
      <option value="">{UNANSWERED_LABEL}</option>
      <option value="no">{no}</option>
      <option value="yes">{yes}</option>
    </Select>
  );
}

/**
 * Shabbat has two empties: unanswered, and "Prefer not to say" — a real answer
 * that scores as neutral. An HTML select gives every blank option the same
 * value, so the chosen one travels as a word and `shabbatAnswer` maps it back
 * to the empty string the column stores.
 */
function ShabbatChoice({ value }: { value: Profile["shabbat"] }) {
  const options = SHABBAT_LEVELS.map((o) => (o.key === "" ? { key: PREFER_NOT_TO_SAY, label: o.label } : o));
  return <Choice name="shabbat" value={value === null ? null : value === "" ? PREFER_NOT_TO_SAY : value} options={options} />;
}

/**
 * Daily life as a two-column table: how I live beside what I want in
 * roommates, one row per habit. Every cell is a plain form control, so the
 * table submits with the profile form; the scores in lib/compatibility.ts
 * read both columns.
 *
 * Nothing here is required — the form saves half-answered. What the table
 * gates is the swipe deck, which ranks rooms by these answers and stays shut
 * until they are all in (`isDailyLifeComplete`).
 */
export function DailyLifeFields({ profile: p }: { profile: Profile | null }) {
  return (
    <div role="table" aria-label="Daily life" className="rounded-2xl border border-hairline bg-surface px-4 pb-1 pt-3 sm:px-5">
      <DailyLifeHead cols={cols} className="pb-2.5" />

      <Row
        label="Smoking"
        mine={<YesNo name="smoker" checked={p?.smoker ?? null} yes="I smoke" no="I don't smoke" />}
        wants={<YesNo name="ok_with_smoker" checked={p?.ok_with_smoker ?? null} yes="Fine with a smoker" no="Non-smokers only" />}
      />
      <Row
        label="Pets"
        mine={<YesNo name="has_pet" checked={p?.has_pet ?? null} yes="I have a pet" no="No pets" />}
        wants={<YesNo name="ok_with_pets" checked={p?.ok_with_pets ?? null} yes="Pets welcome" no="No pets, please" />}
      />
      <Row
        label="Cleanliness"
        mine={<Choice name="cleanliness" value={p?.cleanliness ?? null} options={CLEANLINESS_LEVELS} />}
        wants={<Choice name="pref_cleanliness" value={p?.pref_cleanliness ?? null} options={PREF_CLEANLINESS} />}
      />
      <Row
        label="Schedule"
        mine={<Choice name="sleep_schedule" value={p?.sleep_schedule ?? null} options={SLEEP_SCHEDULES} />}
        wants={<Choice name="pref_sleep" value={p?.pref_sleep ?? null} options={PREF_SLEEP} />}
      />
      <Row
        label="Guests"
        mine={<Choice name="guests_freq" value={p?.guests_freq ?? null} options={GUEST_FREQS} />}
        wants={<Choice name="pref_guests" value={p?.pref_guests ?? null} options={PREF_GUESTS} />}
      />
      <Row
        label="Noise"
        mine={<Choice name="noise_level" value={p?.noise_level ?? null} options={NOISE_LEVELS} />}
        wants={<Choice name="pref_noise" value={p?.pref_noise ?? null} options={PREF_NOISE} />}
      />
      <Row
        label="Dietary restrictions"
        mine={<Choice name="dietary" value={p?.diet ?? null} options={DIETS} />}
        wants={<Choice name="pref_diet" value={p?.pref_diet ?? null} options={PREF_DIET} />}
      />
      {/*
        Gender is the one row with nothing on the left. The member states their
        gender once, up beside their age, and repeating it here as a second
        input would give them two places to change one fact. What belongs in
        this table is the requirement, so that is all this row carries.
      */}
      <Row
        label="Gender"
        mine={<p className="text-xs text-muted">Set above, beside your age.</p>}
        wants={
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pref_same_gender" defaultChecked={p?.pref_same_gender ?? false} />
            Same gender as me
          </label>
        }
      />
      <Row
        label="Shabbat"
        mine={<ShabbatChoice value={p?.shabbat ?? null} />}
        wants={<Choice name="pref_shabbat" value={p?.pref_shabbat ?? null} options={PREF_SHABBAT} />}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FEATURES, LEASE_TERMS, SAFE_ROOM_FILTERS } from "@/lib/constants";
import { CityCombobox } from "@/components/ui/CityCombobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { AmountInput } from "@/components/ui/AmountInput";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[11px] font-semibold uppercase tracking-widest text-muted";

/**
 * Filters where the option literally called "any" means "don't filter", so it
 * is dropped from the URL rather than sent. `household_gender` has no such
 * option any more — see HOUSEHOLD_GENDERS.
 */
const ANY_MEANS_UNSET = new Set(["lease_term", "safe_room"]);

/**
 * The whole of "All roommates of the same gender": two options, nothing else
 * (user decision, 2026-09-01). The tick is the on/off; this says which of the
 * two, and the first is what an untouched tick means.
 */
const HOUSEHOLD_GENDERS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
] as const;

/**
 * GET-style filters: submits the chosen filters into /browse?… search params
 * (the server re-queries; no client-side filtering). Vertical sidebar card on
 * lg+; below lg it collapses behind a "Filters" button that opens a bottom
 * drawer.
 */
export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  // "All roommates of the same gender" is two controls that mean one thing:
  // the tick decides whether to filter at all, the dropdown says which gender.
  // The URL carries only the gender, so the tick starts from it and is re-read
  // after every apply — but in between it is the tick that rules. Deriving
  // `checked` from the URL *as well* is what made an applied filter impossible
  // to switch off: unticking cleared the state, the URL still said "male", and
  // the box sprang straight back on with the dropdown still submitting.
  const appliedGender = params.get("household_gender");
  const [sameGender, setSameGender] = useState(Boolean(appliedGender));
  // Bumped by "Clear filters" so the fields remount even when the URL does not
  // change — see `clear()`.
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    setSameGender(Boolean(appliedGender));
  }, [appliedGender]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function apply(formData: FormData) {
    const next = new URLSearchParams();
    // Keep the chosen ordering and List/Map view across a filter change.
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    const view = params.get("view");
    if (view) next.set("view", view);
    for (const [key, value] of formData.entries()) {
      const v = String(value);
      if (v === "" || (v === "any" && ANY_MEANS_UNSET.has(key))) continue;
      next.set(key, v === "on" ? "true" : v);
    }
    setOpen(false);
    router.push(`/browse?${next.toString()}`);
  }

  /**
   * Empty every filter and show the unfiltered Listings again. Ordering and
   * List/Map view survive, exactly as they do through `apply` — they are how
   * the member is reading the page, not something they filtered by.
   *
   * Two things have to happen, and neither covers the other. The push is what
   * actually clears the results, since the server filters from the URL. The
   * remount (`resetKey`, in the form's key) is what empties the fields: they
   * are uncontrolled, and `AmountInput` holds its digits in React state of its
   * own, so neither a re-render nor `form.reset()` would blank the rents.
   * Without the bump, clearing while already unfiltered — filters typed but
   * never applied — pushes the URL it is already on, re-renders nothing, and
   * leaves the typed text sitting there.
   */
  function clear() {
    const next = new URLSearchParams();
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    const view = params.get("view");
    if (view) next.set("view", view);
    setSameGender(false);
    setResetKey((n) => n + 1);
    setOpen(false);
    const qs = next.toString();
    router.push(qs ? `/browse?${qs}` : "/browse");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-hairline bg-surface px-4 py-2.5 text-sm font-medium text-ink lg:hidden"
      >
        Filters
      </button>

      {open ? (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          data-cursor="arrow"
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
        />
      ) : null}

      <div
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label={open ? "Filters" : undefined}
        className={
          open
            ? "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface p-5 shadow-xl lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-2xl lg:border lg:shadow-none"
            : "hidden rounded-2xl border border-hairline bg-surface p-5 lg:flex lg:h-full lg:flex-col lg:overflow-hidden"
        }
      >
        {open ? (
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <p className="text-lg font-semibold">Filters</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-muted hover:text-ink"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ) : null}

        <p className="mb-4 hidden text-lg font-semibold lg:block">Filters</p>

        {/* Keyed on the applied filters (and on `resetKey`) so every field
            re-seeds from the URL after an apply or a clear — the per-<Select>
            keys below do the same job one control at a time. */}
        <form key={`${params.toString()}|${resetKey}`} action={apply} className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          {/* Only the fields scroll; "Apply filters" is pinned below them, so it
              is on screen whatever the scroll position. The negative margin lets
              the scrollbar sit against the card edge rather than inside it. */}
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:-mr-4 lg:pr-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-4">
              <label className={label} htmlFor="filter-city">City
                <CityCombobox id="filter-city" name="city" defaultValue={params.get("city") ?? ""} placeholder="Any city" className={input} />
              </label>
              <label className={label}>Min rent (₪)
                <AmountInput name="rent_min" defaultValue={params.get("rent_min") ?? ""} className={input} />
              </label>
              <label className={label}>Max rent (₪)
                <AmountInput name="rent_max" defaultValue={params.get("rent_max") ?? ""} className={input} />
              </label>
              <label className={label}>Move in by
                <DatePicker name="move_in_by" defaultValue={params.get("move_in_by") ?? ""} clearable placeholder="Any date" />
              </label>
              <label className={label}>For how long
                {/* keyed by the URL value: React resets the form after the action and a
                    <select> only takes its defaultValue on mount, so remount it per navigation */}
                <Select key={params.get("lease_term") ?? ""} name="lease_term" defaultValue={params.get("lease_term") ?? ""}>
                  <option value="">Any length</option>
                  {LEASE_TERMS.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </Select>
              </label>
              <label className={label}>Mamad
                <Select key={params.get("safe_room") ?? ""} name="safe_room" defaultValue={params.get("safe_room") ?? ""}>
                  <option value="">Any</option>
                  {SAFE_ROOM_FILTERS.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </Select>
              </label>
              <label className={label}>Max roommates
                <input name="roommates_max" type="number" min={0} max={10} defaultValue={params.get("roommates_max") ?? ""} className={input} />
              </label>
            </div>

            <div className="mt-4 lg:mt-5">
              <label className="flex items-center gap-2 text-sm lg:text-base">
                <input
                  type="checkbox"
                  checked={sameGender}
                  onChange={(e) => setSameGender(e.target.checked)}
                />
                All roommates of the same gender
              </label>
              {sameGender ? (
                <Select
                  key={appliedGender ?? ""}
                  name="household_gender"
                  aria-label="Which gender"
                  defaultValue={appliedGender ?? HOUSEHOLD_GENDERS[0].key}
                  className="mt-2"
                >
                  {HOUSEHOLD_GENDERS.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </Select>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm lg:mt-5 lg:flex-col lg:items-start lg:gap-y-3.5 lg:border-t lg:border-hairline lg:pb-4 lg:pt-5 lg:text-base">
              <label className="flex items-center gap-1.5 lg:gap-2.5">
                <input type="checkbox" name="pets_allowed" defaultChecked={params.get("pets_allowed") === "true"} /> Pets allowed
              </label>
              <label className="flex items-center gap-1.5 lg:gap-2.5">
                <input type="checkbox" name="smoking_allowed" defaultChecked={params.get("smoking_allowed") === "true"} /> Smoking allowed
              </label>
              {FEATURES.map((f) => (
                <label key={f.key} className="flex items-center gap-1.5 lg:gap-2.5">
                  <input type="checkbox" name={f.key} defaultChecked={params.get(f.key) === "true"} /> {f.label}
                </label>
              ))}
            </div>
          </div>
          <div className="lg:-mx-5 lg:shrink-0 lg:border-t lg:border-hairline lg:px-5 lg:pt-4">
            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast lg:mt-0"
            >
              Apply filters
            </button>
            {/* Red, in the app's own danger tone rather than a raw red, and
                outlined so it reads as the quieter of the two — undoing a
                search is not the destination of this card. */}
            <button
              type="button"
              onClick={clear}
              className="mt-2 w-full rounded-xl border border-danger bg-danger/10 px-5 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/15"
            >
              Clear filters
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FEATURES, GENDERS, LEASE_TERMS, SAFE_ROOM_FILTERS } from "@/lib/constants";
import { CityCombobox } from "@/components/ui/CityCombobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[11px] font-semibold uppercase tracking-widest text-muted";

/**
 * Filters where the option literally called "any" means "don't filter", so it
 * is dropped from the URL rather than sent. `household_gender` is deliberately
 * NOT one of them: there "any" means "all the same, and I don't mind which",
 * which is a narrower search than no filter at all — a blanket skip silently
 * threw it away.
 */
const ANY_MEANS_UNSET = new Set(["lease_term", "safe_room"]);

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
  // The URL carries only the gender, so the tick is derived from it.
  const [sameGender, setSameGender] = useState(false);

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
            : "hidden rounded-2xl border border-hairline bg-surface p-5 lg:flex lg:h-full lg:flex-col lg:overflow-y-auto"
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

        <form action={apply} className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-4">
            <label className={label} htmlFor="filter-city">City
              <CityCombobox id="filter-city" name="city" defaultValue={params.get("city") ?? ""} placeholder="Any city" className={input} />
            </label>
            <label className={label}>Min rent (₪)
              <input name="rent_min" type="number" min={0} defaultValue={params.get("rent_min") ?? ""} className={input} />
            </label>
            <label className={label}>Max rent (₪)
              <input name="rent_max" type="number" min={0} defaultValue={params.get("rent_max") ?? ""} className={input} />
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
                checked={sameGender || Boolean(params.get("household_gender"))}
                onChange={(e) => setSameGender(e.target.checked)}
              />
              All roommates of the same gender
            </label>
            {sameGender || params.get("household_gender") ? (
              <Select
                key={params.get("household_gender") ?? ""}
                name="household_gender"
                aria-label="Which gender"
                defaultValue={params.get("household_gender") ?? "any"}
                className="mt-2"
              >
                <option value="any">Any gender, as long as they all match</option>
                {GENDERS.map((g) => (
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
          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast lg:mt-auto"
          >
            Apply filters
          </button>
        </form>
      </div>
    </>
  );
}

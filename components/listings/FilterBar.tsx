"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CITIES, FEATURES } from "@/lib/constants";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[10px] font-semibold uppercase tracking-widest text-muted";

/**
 * GET-style filter bar: submits the chosen filters into /browse?… search params
 * (the server re-queries; no client-side filtering). Inline on sm+; below sm it
 * collapses behind a "Filters" button that opens a bottom drawer.
 */
export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

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
    for (const [key, value] of formData.entries()) {
      const v = String(value);
      if (v === "" || v === "any") continue;
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
        className="w-full rounded-xl border border-hairline bg-surface px-4 py-2.5 text-sm font-medium text-ink sm:hidden"
      >
        Filters
      </button>

      {open ? (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 sm:hidden"
        />
      ) : null}

      <div
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label={open ? "Filters" : undefined}
        className={
          open
            ? "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface p-5 shadow-xl sm:static sm:z-auto sm:max-h-none sm:overflow-visible sm:rounded-2xl sm:border sm:p-4 sm:shadow-none"
            : "hidden rounded-2xl border border-hairline bg-surface p-4 sm:block"
        }
      >
        {open ? (
          <div className="mb-4 flex items-center justify-between sm:hidden">
            <p className="font-serif text-lg font-semibold">Filters</p>
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

        <form action={apply}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className={label}>City
              <select name="city" defaultValue={params.get("city") ?? "any"} className={input}>
                <option value="any">Any city</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className={label}>Min rent (₪)
              <input name="rent_min" type="number" min={0} defaultValue={params.get("rent_min") ?? ""} className={input} />
            </label>
            <label className={label}>Max rent (₪)
              <input name="rent_max" type="number" min={0} defaultValue={params.get("rent_max") ?? ""} className={input} />
            </label>
            <label className={label}>Move in by
              <input name="move_in_by" type="date" defaultValue={params.get("move_in_by") ?? ""} className={input} />
            </label>
            <label className={label}>Max roommates
              <input name="roommates_max" type="number" min={0} max={10} defaultValue={params.get("roommates_max") ?? ""} className={input} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="pets_allowed" defaultChecked={params.get("pets_allowed") === "true"} /> Pets allowed
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="smoking_allowed" defaultChecked={params.get("smoking_allowed") === "true"} /> Smoking allowed
            </label>
            {FEATURES.map((f) => (
              <label key={f.key} className="flex items-center gap-1.5">
                <input type="checkbox" name={f.key} defaultChecked={params.get(f.key) === "true"} /> {f.label}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast sm:mt-4 sm:w-auto sm:py-2"
          >
            Apply filters
          </button>
        </form>
      </div>
    </>
  );
}

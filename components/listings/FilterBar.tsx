"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CITIES, FEATURES } from "@/lib/constants";

const input =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const label = "block text-[10px] font-semibold uppercase tracking-widest text-muted";

export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();

  function apply(formData: FormData) {
    const next = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const v = String(value);
      if (v === "" || v === "any") continue;
      next.set(key, v === "on" ? "true" : v);
    }
    router.push(`/browse?${next.toString()}`);
  }

  return (
    <form action={apply} className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
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
      <button type="submit" className="mt-4 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast">
        Apply filters
      </button>
    </form>
  );
}

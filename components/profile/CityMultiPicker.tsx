"use client";

import { useState } from "react";
import { CityCombobox } from "@/components/ui/CityCombobox";

/** Preferred cities as removable chips, added through the city type-ahead. */
export function CityMultiPicker({ name, initial }: { name: string; initial: string[] }) {
  const [cities, setCities] = useState<string[]>(initial);

  return (
    <div>
      {cities.map((c) => (
        <input key={c} type="hidden" name={name} value={c} />
      ))}
      <CityCombobox
        id={`${name}-picker`}
        placeholder="Add a city — e.g. hai → Haifa"
        clearOnSelect
        onSelect={(city) => setCities((prev) => (prev.includes(city) ? prev : [...prev, city]))}
      />
      {cities.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected cities">
          {cities.map((c) => (
            <li
              key={c}
              className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
            >
              {c}
              <button
                type="button"
                aria-label={`Remove ${c}`}
                onClick={() => setCities((prev) => prev.filter((x) => x !== c))}
                className="text-accent/70 hover:text-accent"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">No preference yet — any city works.</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { matchCity, suggestCities, type City } from "@/lib/cities";

const inputClass =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";

/**
 * Type-ahead for Israeli cities: "hai" → Haifa, Hadera…; arrow keys + Enter
 * pick, Escape closes, blur snaps free text to its canonical city. Submits as
 * a plain text input (`name`), so forms and filters keep their GET/POST shape.
 */
export function CityCombobox({
  name,
  id,
  defaultValue = "",
  required = false,
  placeholder = "Start typing a city…",
  className = inputClass,
  clearOnSelect = false,
  onSelect,
}: {
  name?: string;
  id?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  /** Multi-pickers: empty the box after a pick. */
  clearOnSelect?: boolean;
  onSelect?: (city: City) => void;
}) {
  const reactId = useId();
  const inputId = id ?? `city-${reactId}`;
  const listId = `${inputId}-list`;
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const suggestions = open ? suggestCities(value) : [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (city: City) => {
    setValue(clearOnSelect ? "" : city);
    setOpen(false);
    setActive(0);
    onSelect?.(city);
  };

  return (
    <div ref={wrap} className="relative">
      <input
        id={inputId}
        name={name}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Snap "haifa" → "Haifa" so the server's enum check passes.
          const canonical = matchCity(value);
          if (canonical && canonical !== value && !clearOnSelect) setValue(canonical);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(0, suggestCities(value).length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            if (open && suggestions[active]) {
              e.preventDefault();
              pick(suggestions[active]);
            } else if (clearOnSelect) {
              const canonical = matchCity(value);
              if (canonical) {
                e.preventDefault();
                pick(canonical);
              }
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={className}
      />
      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-hairline bg-surface py-1 font-normal normal-case tracking-normal shadow-[0_18px_40px_-14px_rgba(0,0,0,0.35)]"
        >
          {suggestions.map((city, i) => (
            <li
              key={city}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't fire first
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(city)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent/10 text-accent" : "text-ink"}`}
            >
              {city}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

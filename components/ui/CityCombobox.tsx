"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CITIES, matchCity, suggestCities, type City } from "@/lib/cities";

const inputClass =
  "mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";

/**
 * Type-ahead for Israeli cities: "hai" → Haifa, Hadera…; arrow keys + Enter
 * pick, Escape closes, blur snaps free text to its canonical city. Submits as
 * a plain text input (`name`), so forms and filters keep their GET/POST shape.
 *
 * Two ways in: type to filter (every match is listed), or open the chevron /
 * focus the empty box to scroll the full A–Z list grouped by first letter.
 */
export function CityCombobox({
  name,
  id,
  defaultValue = "",
  required = false,
  placeholder = "Type a city or browse the list…",
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
  /** Chevron mode: show every city regardless of what's typed, until the user types again. */
  const [browseAll, setBrowseAll] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const showingAll = browseAll || value.trim() === "";
  const suggestions: readonly City[] = open ? (showingAll ? CITIES : suggestCities(value, CITIES.length)) : [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
        setBrowseAll(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted row visible while arrowing through a long list, and
  // snap back to the top whenever the list contents change (typing, browse-all).
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[id="${listId}-${active}"]`)?.scrollIntoView?.({ block: "nearest" }); // optional: jsdom lacks it
  }, [open, active, listId, value, browseAll]);

  const close = () => {
    setOpen(false);
    setBrowseAll(false);
  };

  const pick = (city: City) => {
    setValue(clearOnSelect ? "" : city);
    close();
    setActive(0);
    onSelect?.(city);
  };

  const toggleBrowse = () => {
    if (open && browseAll) {
      close();
      return;
    }
    setBrowseAll(true);
    setOpen(true);
    setActive(0);
    input.current?.focus();
  };

  return (
    <div ref={wrap} className="relative">
      <input
        ref={input}
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
          setBrowseAll(false);
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
            if (!open) {
              setOpen(true);
              return;
            }
            setActive((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
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
            close();
          }
        }}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        aria-label={open && browseAll ? "Hide city list" : "Browse all cities"}
        aria-expanded={open && browseAll}
        aria-controls={listId}
        onMouseDown={(e) => e.preventDefault()} // keep input focus; blur must not fire first
        onClick={toggleBrowse}
        className="absolute bottom-0 right-0 top-1 flex w-10 items-center justify-center text-muted hover:text-ink"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 transition-transform ${open && browseAll ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {open && suggestions.length > 0 ? (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={showingAll ? "All cities" : "Matching cities"}
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-hairline bg-surface py-1 font-normal normal-case tracking-normal shadow-[0_18px_40px_-14px_rgba(0,0,0,0.35)]"
        >
          {showingAll ? (
            <li role="presentation" className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
              All cities · {CITIES.length}
            </li>
          ) : null}
          {suggestions.map((city, i) => {
            const letter = city[0].toUpperCase();
            const newLetter = showingAll && (i === 0 || suggestions[i - 1][0].toUpperCase() !== letter);
            return (
              <li key={city} role="presentation">
                {newLetter ? (
                  <div
                    aria-hidden="true"
                    className="sticky top-0 z-10 border-b border-hairline bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent"
                  >
                    {letter}
                  </div>
                ) : null}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't fire first
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(city)}
                  className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent/10 text-accent" : "text-ink"}`}
                >
                  {city}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

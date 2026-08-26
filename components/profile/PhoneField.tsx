"use client";

import { useEffect, useId, useRef, useState } from "react";
import { composePhone, flagSrc, splitPhone, suggestCountries, type Country } from "@/lib/phone";

const inputBase =
  "rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent";

/** Maximum stored length is 30 (DB check); the dial code and a space take the rest. */
const MAX_STORED = 30;

function Flag({ country, className = "" }: { country: Country; className?: string }) {
  // Static SVGs under /public — next/image would add nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={flagSrc(country.code)} alt="" width={20} height={14} className={`h-3.5 w-5 shrink-0 rounded-[2px] object-cover ${className}`} />;
}

/**
 * Phone number with a country picker: a searchable country box (flag + dial
 * code; type a name, a code or digits — same keyboard model as the city
 * combobox) beside the local number. Submits one value, `name`, as
 * "+972 50-123-4567" (see composePhone), so the server and the column stay
 * as they are. Israel is preselected for an empty or un-prefixed number.
 */
export function PhoneField({
  name = "phone",
  defaultValue = "",
  label = "Phone number",
  labelClassName = "block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted",
  inputClassName = inputBase,
  className = "",
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
  labelClassName?: string;
  inputClassName?: string;
  className?: string;
}) {
  const reactId = useId();
  const listId = `country-${reactId}-list`;
  const [initial] = useState(() => splitPhone(defaultValue));
  const [country, setCountry] = useState<Country>(initial.country);
  const [local, setLocal] = useState(initial.local);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const number = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const suggestions = open ? suggestCountries(query) : [];

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[id="${listId}-${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, listId, query]);

  const openList = () => {
    setOpen(true);
    // Start the list at the current country so a scroll wheel lands somewhere familiar.
    setActive(Math.max(0, suggestCountries("").findIndex((c) => c.code === country.code)));
  };

  const pick = (c: Country) => {
    setCountry(c);
    close();
    number.current?.focus();
  };

  const maxLocal = Math.max(8, MAX_STORED - country.dial.length - 1);

  return (
    <div className={className}>
      <div className={labelClassName}>
        {label}
        <div className="mt-1 flex gap-2">
          <div ref={wrap} className="relative w-[8.75rem] shrink-0">
            <Flag country={country} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={search}
              role="combobox"
              aria-label="Country code"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined}
              autoComplete="off"
              placeholder={open ? "Search…" : undefined}
              title={`${country.name} ${country.dial}`}
              value={open ? query : country.dial}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                if (!open) setOpen(true);
              }}
              onFocus={openList}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (!open) openList();
                  else setActive((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  if (open && suggestions[active]) {
                    e.preventDefault();
                    pick(suggestions[active]);
                  }
                } else if (e.key === "Escape" || e.key === "Tab") {
                  close();
                }
              }}
              className={`${inputClassName} w-full pl-10 pr-8 tabular-nums`}
            />
            <button
              type="button"
              aria-label={open ? "Hide country list" : "Choose country"}
              aria-expanded={open}
              aria-controls={listId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (open ? close() : (search.current?.focus(), openList()))}
              className="absolute bottom-0 right-0 top-0 flex w-8 items-center justify-center text-muted hover:text-ink"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
            {open && suggestions.length > 0 ? (
              <ul
                ref={list}
                id={listId}
                role="listbox"
                aria-label="Countries"
                className="absolute left-0 z-50 mt-1 max-h-64 w-72 overflow-y-auto rounded-xl border border-hairline bg-surface py-1 font-normal normal-case tracking-normal shadow-[0_18px_40px_-14px_rgba(0,0,0,0.35)]"
              >
                {suggestions.map((c, i) => (
                  <li
                    key={c.code}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(c)}
                    className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm ${i === active ? "bg-accent/10 text-accent" : "text-ink"}`}
                  >
                    <Flag country={c} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className={`shrink-0 tabular-nums ${i === active ? "text-accent" : "text-muted"}`}>{c.dial}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <input
            ref={number}
            type="tel"
            inputMode="tel"
            aria-label={label}
            autoComplete="tel-national"
            maxLength={maxLocal}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="50-123-4567"
            className={`${inputClassName} min-w-0 flex-1`}
          />
        </div>
      </div>
      <input type="hidden" name={name} value={composePhone(country.dial, local)} />
    </div>
  );
}

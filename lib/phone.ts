import { COUNTRIES, type Country } from "@/lib/countries-data";

export { COUNTRIES };
export type { Country };

/** NestUp is an Israeli app: a number typed without a country is an Israeli one. */
export const DEFAULT_COUNTRY: Country = COUNTRIES.find((c) => c.code === "IL") ?? COUNTRIES[0];

/** Dialling codes shared by several countries resolve to the one people usually mean. */
const PRIMARY: Record<string, string> = {
  "+1": "US",
  "+7": "RU",
  "+44": "GB",
  "+47": "NO",
  "+61": "AU",
  "+212": "MA",
  "+262": "RE",
  "+290": "SH",
  "+358": "FI",
  "+590": "GP",
  "+596": "MQ",
  "+599": "CW",
};

const fold = (s: string) => s.toLowerCase().replace(/['’\-\s.]/g, "");

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function flagSrc(code: string): string {
  return `/flags/${code}.svg`;
}

/**
 * Suggestions for what's typed in the country box: by name (prefix first,
 * then any word — "king" → United Kingdom — then substring), by dialling
 * code ("97", "+972") and by ISO code ("il"). Empty query → every country.
 */
export function suggestCountries(query: string, limit = COUNTRIES.length): Country[] {
  const raw = query.trim();
  if (!raw) return COUNTRIES.slice(0, limit);
  const q = fold(raw);
  const digits = raw.replace(/[^\d]/g, "");
  const byDial = /^\+?\d+$/.test(raw) && digits.length > 0;
  const starts: Country[] = [];
  const words: Country[] = [];
  const contains: Country[] = [];
  for (const c of COUNTRIES) {
    if (byDial) {
      if (c.dial.slice(1).startsWith(digits)) starts.push(c);
      continue;
    }
    const f = fold(c.name);
    if (f.startsWith(q) || c.code.toLowerCase() === q) starts.push(c);
    else if (c.name.toLowerCase().split(/[\s\-]+/).some((w) => fold(w).startsWith(q))) words.push(c);
    else if (f.includes(q)) contains.push(c);
  }
  return [...starts, ...words, ...contains].slice(0, limit);
}

/**
 * Takes a stored number apart: "+44 7700 900123" → United Kingdom + "7700 900123".
 * A number without a "+" (older profiles, or one typed as 050-…) is Israeli.
 */
export function splitPhone(stored: string): { country: Country; local: string } {
  const s = stored.trim();
  if (!s.startsWith("+")) return { country: DEFAULT_COUNTRY, local: s };
  const digits = "+" + s.slice(1).replace(/[^\d]/g, "");
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (!digits.startsWith(c.dial)) continue;
    if (!best || c.dial.length > best.dial.length) best = c;
    else if (c.dial.length === best.dial.length && PRIMARY[c.dial] === c.code) best = c;
  }
  if (!best) return { country: DEFAULT_COUNTRY, local: s };
  return { country: best, local: s.slice(best.dial.length).trim() };
}

/**
 * What gets stored: "+972 50-123-4567". A leading trunk "0" is dropped so the
 * number dials from abroad (Italy keeps its 0 — there it is part of the number).
 * Empty local number → empty string, so an untouched field stays empty.
 */
export function composePhone(dial: string, local: string): string {
  let l = local.trim();
  if (!l) return "";
  if (dial !== "+39" && /^0[\d\s\-().]/.test(l)) l = l.slice(1).trim();
  return `${dial} ${l}`;
}

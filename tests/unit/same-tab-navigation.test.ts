/**
 * Guards the navigation contract: internal links always stay in the current
 * tab and go through next/link's client-side router. Only external links may
 * open a new tab, and then only with rel="noopener"/"noreferrer".
 *
 * The scanner is exercised on inline fixtures first (so a silent regex bug
 * can't turn the real scan into a no-op), then on every file under app/,
 * components/ and lib/.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SCAN_DIRS = ["app", "components", "lib"];
const SOURCE = /\.(tsx?|jsx?)$/;

interface Violation {
  file: string;
  line: number;
  reason: string;
}

/** Collect `<a …>` / `<Link …>` opening tags, tolerating `=>` inside JSX expressions. */
function openingTags(source: string): { tag: string; text: string; index: number }[] {
  const out: { tag: string; text: string; index: number }[] = [];
  const re = /<(a|Link)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
    }
    out.push({ tag: m[1], text: source.slice(m.index, i + 1), index: m.index });
  }
  return out;
}

function hrefIsInternal(tag: string): boolean | null {
  const literal = /\bhref=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/.exec(tag);
  if (!literal) return null; // href from a variable — can't tell statically
  const value = literal[1] ?? literal[2] ?? literal[3] ?? "";
  return value.startsWith("/") || value.startsWith("#") || value === "";
}

export function scanSource(source: string, file: string): Violation[] {
  const violations: Violation[] = [];
  const lineOf = (index: number) => source.slice(0, index).split("\n").length;

  for (const pattern of [/window\.open\s*\(/g, /<base\b/g, /\bformtarget=/gi, /<form\b[^>]*\btarget=/g]) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(source))) {
      violations.push({ file, line: lineOf(m.index), reason: `forbidden navigation primitive: ${m[0].trim()}` });
    }
  }

  for (const { tag, text, index } of openingTags(source)) {
    const hasTarget = /\btarget=/.test(text);
    if (!hasTarget) continue;
    const line = lineOf(index);
    if (tag === "Link") {
      violations.push({ file, line, reason: "<Link> must not carry a target attribute" });
      continue;
    }
    const internal = hrefIsInternal(text);
    if (internal) {
      violations.push({ file, line, reason: "internal <a> must not open a new tab (use <Link> instead)" });
      continue;
    }
    if (!/\brel=["'][^"']*(noopener|noreferrer)/.test(text)) {
      violations.push({ file, line, reason: 'external new-tab link needs rel="noopener" or "noreferrer"' });
    }
  }
  return violations;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (SOURCE.test(entry)) acc.push(full);
  }
  return acc;
}

describe("scanner", () => {
  test("flags internal links that would open a new tab", () => {
    const bad = [
      '<a href="/swipe" target="_blank">Swipe</a>',
      "<Link href={`/chat/${id}`} target=\"_blank\">Chat</Link>",
      '<a href="/profile" onClick={() => go()} target="_blank">Profile</a>',
      "onClick={() => window.open('/browse')}",
      '<base target="_blank" />',
      '<form action="/x" target="_blank">',
    ].join("\n");
    const reasons = scanSource(bad, "fixture.tsx").map((v) => `${v.line}:${v.reason}`);
    expect(reasons).toEqual([
      "4:forbidden navigation primitive: window.open(",
      "5:forbidden navigation primitive: <base",
      '6:forbidden navigation primitive: <form action="/x" target=',
      "1:internal <a> must not open a new tab (use <Link> instead)",
      "2:<Link> must not carry a target attribute",
      "3:internal <a> must not open a new tab (use <Link> instead)",
    ]);
  });

  test("allows same-tab internal links and safe external new-tab links", () => {
    const good = [
      '<Link href="/swipe" className="x">Swipe</Link>',
      "<Link href={`/browse/${listing.id}`} onClick={() => track()}>Room</Link>",
      '<a href="/api/google/connect?return=%2Fchat">Connect</a>',
      '<a href="https://calendar.google.com" target="_blank" rel="noreferrer">Calendar</a>',
      '<a href={viewing.google_event_link} target="_blank" rel="noopener noreferrer">Open</a>',
    ].join("\n");
    expect(scanSource(good, "fixture.tsx")).toEqual([]);
  });

  test("requires rel on external new-tab links", () => {
    const missingRel = '<a href="https://example.com" target="_blank">x</a>';
    expect(scanSource(missingRel, "fixture.tsx").map((v) => v.reason)).toEqual([
      'external new-tab link needs rel="noopener" or "noreferrer"',
    ]);
  });
});

test("no internal navigation in app/, components/ or lib/ opens a new tab", () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  expect(files.length).toBeGreaterThan(20);
  const violations = files.flatMap((f) => scanSource(readFileSync(f, "utf8"), relative(ROOT, f)));
  expect(violations.map((v) => `${v.file}:${v.line} ${v.reason}`)).toEqual([]);
});

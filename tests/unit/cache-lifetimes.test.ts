// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * Every cached read must declare `stale` of at least 300 seconds.
 *
 * This is a threshold in Next, not a preference. From the `cacheLife`
 * prerendering rules: a `stale` under five minutes keeps the cached value OUT
 * of the route's App Shell — and with `partialPrefetching` the App Shell is
 * precisely what a `<Link>` sends ahead when it comes into view.
 *
 * So at `stale: 60`, which is what these all carried, the prefetch arrived
 * holding a shell with a hole where the data goes, and tapping the tab still
 * paid for the read behind a skeleton. The caching looked right in every other
 * respect and bought nothing on the navigation it was written for. Raising the
 * number is the entire fix, which is exactly why it needs a test: it is one
 * digit, it has no visible effect in development, and "60 seconds is plenty
 * fresh" is a reasonable-sounding thing for someone to write next year.
 *
 * Freshness does not rest on this window. Every write calls `updateTag`, which
 * expires the entry immediately whatever `stale` says.
 */
const CACHED_READS = [
  "lib/listings.ts",
  "lib/profile-data.ts",
  "lib/swipe-deck.ts",
  "lib/chat.ts",
];

/** The App Shell cut-off, in seconds. */
const APP_SHELL_MIN_STALE = 300;

test("every cacheLife stale window is long enough to ride in the App Shell", () => {
  const found: { file: string; stale: number }[] = [];

  for (const file of CACHED_READS) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    for (const m of source.matchAll(/cacheLife\(\{\s*stale:\s*(\d+)/g)) {
      found.push({ file, stale: Number(m[1]) });
    }
  }

  // Guards the list above: a file renamed or a directive dropped would other-
  // wise make this pass by finding nothing at all.
  expect(found.length).toBe(5);

  for (const { file, stale } of found) {
    expect(stale, `${file} caches with stale: ${stale}`).toBeGreaterThanOrEqual(APP_SHELL_MIN_STALE);
  }
});

/**
 * The client-side router cache has to last at least as long as the data caches
 * behind it. When it was 30s against `stale: 300`, returning to a tab after
 * half a minute threw away a rendered payload whose data was still perfectly
 * good, and paid a server round-trip and a skeleton to rebuild it.
 */
test("the router's dynamic cache is not shorter than the data caches", () => {
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  const dynamic = Number(/staleTimes:\s*\{\s*dynamic:\s*(\d+)/.exec(config)?.[1]);

  expect(Number.isFinite(dynamic)).toBe(true);
  expect(dynamic).toBeGreaterThanOrEqual(APP_SHELL_MIN_STALE);
});

/**
 * Partial prefetching is what puts the App Shell on the wire in the first
 * place, and Cache Components is what allows `use cache: private`. Neither is
 * optional for any of the above to mean anything.
 */
test("the config flags the caching strategy depends on are on", () => {
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  expect(config).toMatch(/cacheComponents:\s*true/);
  expect(config).toMatch(/partialPrefetching:\s*true/);
});

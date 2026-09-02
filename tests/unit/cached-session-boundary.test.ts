// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * The line between "cached for rendering" and "uncached for writing".
 *
 * The signed-in member's identity is cached now (`getCachedSession`), because
 * an uncached `auth.getUser()` at the top of every page was the single read
 * keeping Listings, Chat and Profile out of their own App Shells — the App
 * Shell prerender advances through cached reads and stops at the first uncached
 * one. Removing it took ~300ms of skeleton off each of those tabs.
 *
 * The user accepted the cost that comes with it (2026-09-02): a suspension now
 * takes effect within the cache window rather than on the very next page.
 *
 * They did NOT accept, and were not asked to accept, cached identity
 * authorising writes. Server Actions keep the uncached `requireUser()`. That
 * distinction is invisible — both spellings compile, both "work" — so it is
 * the kind of thing a tidy-up would erase without noticing. Hence these.
 */
const ACTIONS_DIR = new URL("../../app/actions/", import.meta.url);
const CACHED_READERS = ["getCachedSession", "getCachedOwnProfile", "requireCachedSession", "requireCachedProfile"];

const actionFiles = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"));

test("there are action files to check", () => {
  expect(actionFiles.length).toBeGreaterThan(5);
});

test("no Server Action authorises itself with the cached session", () => {
  const offenders: string[] = [];

  for (const file of actionFiles) {
    const source = readFileSync(new URL(file, ACTIONS_DIR), "utf8");
    for (const reader of CACHED_READERS) {
      // Word boundary, so a comment mentioning the name in prose is fine and
      // only a real call or import trips this.
      if (new RegExp(`\\b${reader}\\s*\\(`).test(source)) offenders.push(`${file} calls ${reader}`);
    }
  }

  expect(offenders).toEqual([]);
});

/**
 * The suspension check was allowed to become *slower*, not to disappear. If
 * this read ever goes, a suspended account is never shut out at all, which is
 * a different decision from the one that was made.
 */
test("the cached session still reads the suspensions table", () => {
  const auth = readFileSync(new URL("../../lib/auth.ts", import.meta.url), "utf8");
  const cached = auth.slice(auth.indexOf("export async function getCachedSession"));

  expect(cached).toMatch(/from\("suspensions"\)/);
  expect(cached).toMatch(/suspended:/);
});

/** And the gates still act on it, rather than reading it and shrugging. */
test("the render-time gates still bounce a suspended member", () => {
  const auth = readFileSync(new URL("../../lib/auth.ts", import.meta.url), "utf8");
  const gates = auth.slice(auth.indexOf("export async function requireCachedSession"));

  expect(gates.match(/suspended\)\s*redirect\("\/login\?error=suspended"\)/g)?.length).toBe(2);
});

/**
 * `getCachedSession` caches "nobody" as readily as it caches a member, and
 * signing in is a soft navigation. Without the tag being dropped where a
 * session begins, a visitor who browsed Listings signed out would go on being
 * served as a visitor for the whole window after logging in — no hearts, and
 * Log in / Sign up still in the header.
 */
test("every action that begins or renames a session drops SESSION_TAG", () => {
  const source = readFileSync(new URL("../../app/actions/auth.ts", import.meta.url), "utf8");

  // Sign-in, sign-up code confirmation, e-mail change.
  expect(source.match(/updateTag\(SESSION_TAG\)/g)?.length).toBe(3);
});

/**
 * Logging out is the one session change with no `updateTag`, and that is
 * correct rather than an oversight: it is a Route Handler answering 303, and
 * the full document load it forces empties the private cache outright. A tag
 * could not do it — `updateTag` cannot run in a Route Handler at all.
 */
test("signing out clears the cache by reloading, not by tagging", () => {
  const route = readFileSync(new URL("../../app/auth/signout/route.ts", import.meta.url), "utf8");

  expect(route).toMatch(/status:\s*303/);
  expect(route).not.toMatch(/updateTag/);
});

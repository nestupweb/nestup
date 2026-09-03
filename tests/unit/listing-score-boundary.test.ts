// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * Where a match score may and may not be computed.
 *
 * Listings shows the same two compatibility numbers the swipe deck does, which
 * means a page whose room list is a SHARED cache now also renders a value that
 * is specific to one member. Those two facts have to stay on opposite sides of
 * a line, and the line is not visible in the rendered output — a leak here
 * would look completely correct to whoever introduced it, and would only show
 * up as one member seeing another member's numbers.
 *
 * Hence source-level assertions rather than behavioural ones: the unit suite
 * mocks the Supabase client, so it cannot observe which client a cached read
 * actually used. What it can do is refuse the shapes that would be wrong.
 */
const source = readFileSync(new URL("../../lib/listings.ts", import.meta.url), "utf8");

const slice = (from: string, to?: string) => {
  const start = source.indexOf(from);
  expect(start, `${from} not found — was it renamed?`).toBeGreaterThan(-1);
  return to ? source.slice(start, source.indexOf(to)) : source.slice(start);
};

test("the shared listings cache never computes a score", () => {
  // `queryListings` is the app's only shared `use cache`. It runs on the
  // cookie-free client precisely so one fetch can serve every visitor. Scoring
  // inside it would put one member's compatibility numbers into an entry handed
  // to everybody — a cross-user leak that renders perfectly.
  const shared = slice(
    "export async function queryListings",
    "export async function getSavedListingIds"
  );
  expect(shared).not.toMatch(/lifestyleScore|socialScore|sortKey/);
  expect(shared).toContain("createPublicClient()");
  expect(shared).not.toContain('"use cache: private"');
});

test("the reader that holds member data is private and uses the session client", () => {
  const ctx = slice("export async function getListingScoreContext");
  expect(ctx).toContain('"use cache: private"');
  // `profiles` is readable by authenticated members only (migration 0001), so
  // the cookie-free client returns nothing here — this genuinely has to be the
  // session client, and a swap to the public one would silently blank the
  // scores rather than fail.
  expect(ctx).toContain("await createClient()");
  expect(ctx).not.toContain("createPublicClient");
});

test("the score context is tagged so signing in and editing a profile both re-score", () => {
  const ctx = slice("export async function getListingScoreContext");
  expect(ctx).toContain("cacheTag(SESSION_TAG)");
  expect(ctx).toContain("cacheTag(profileTag(user.id))");
});

test("swipe and Listings render the same score pill", () => {
  // The two pages exist so a member can recognise a room from the deck in the
  // list. That only works if the number is spelled the same way in both, so
  // they share the component rather than each keeping a copy that can drift.
  for (const f of ["components/swipe/SwipeCard.tsx", "components/listings/ListingCard.tsx"]) {
    const src = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
    expect(src, f).toContain('from "@/components/ui/ScorePill"');
  }
  const swipeCard = readFileSync(
    new URL("../../components/swipe/SwipeCard.tsx", import.meta.url),
    "utf8"
  );
  expect(swipeCard).not.toMatch(/function ScorePill\s*\(/);
});

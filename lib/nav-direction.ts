/**
 * Which way the page should slide when moving between the primary tabs.
 * Tabs sit left→right in the bottom nav (Swipe · Listings · Chat · Profile),
 * so going to a tab further right is "forward" (content slides left) and a
 * tab further left is "back". Anything that isn't a tab-to-tab move carries no
 * type, so `<ViewTransition>` falls back to its default (a quick crossfade).
 */
export const TAB_ORDER = ["/swipe", "/browse", "/chat", "/profile"] as const;

export type NavTransitionType = "nav-forward" | "nav-back";

/** Index of the tab a pathname belongs to, or -1 when it's not under a tab. */
export function tabIndex(pathname: string): number {
  return TAB_ORDER.findIndex((tab) => pathname === tab || pathname.startsWith(tab + "/"));
}

/** Transition types for a `<Link>` from `from` to `to` — `[]` when there's no direction. */
export function navTransitionTypes(from: string, to: string): NavTransitionType[] {
  const a = tabIndex(from);
  const b = tabIndex(to);
  if (a < 0 || b < 0 || a === b) return [];
  return [b > a ? "nav-forward" : "nav-back"];
}

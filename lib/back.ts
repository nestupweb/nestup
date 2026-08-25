/**
 * Where "Back" goes when this tab has no in-app page to return to
 * (a deep link, a link from a chat app): the page's parent.
 */
export function parentPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  switch (parts[0]) {
    case "login":
    case "signup":
      return "/";
    case "people":
      return "/swipe";
    case "listing":
      return "/profile";
    case "browse":
      return parts.length > 1 ? "/browse" : "/";
  }
  return parts.length > 1 ? "/" + parts.slice(0, -1).join("/") : "/browse";
}

/** The four tabs (and the landing redirect): top-level pages that never show "Back". */
export const MAIN_PAGES = ["/", "/swipe", "/browse", "/chat", "/profile"] as const;

export function isMainPage(pathname: string): boolean {
  return (MAIN_PAGES as readonly string[]).includes(pathname);
}

/** How a page is named in "Back to …". */
export function pageName(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "listings";
  switch (parts[0]) {
    case "browse":
      return parts.length > 1 ? "room" : "listings";
    case "swipe":
      return "swipe";
    case "chat":
      return parts.length > 1 ? "chat" : "chats";
    case "profile":
      return parts[1] === "edit" ? "edit profile" : "profile";
    case "people":
      return "profile";
    case "listing":
      return "listing form";
    case "login":
      return "log in";
    case "signup":
      return "sign up";
  }
  return "previous page";
}

type NavigationLike = { navigation?: { canGoBack?: boolean }; history: { length: number } };

/**
 * Is there a previous entry to go back to? The Navigation API answers exactly
 * (same-origin entries only, so arriving from another site counts as "no");
 * browsers without it get the history-length heuristic.
 */
export function canGoBack(win: NavigationLike = window as unknown as NavigationLike): boolean {
  const nav = win.navigation;
  if (nav && typeof nav.canGoBack === "boolean") return nav.canGoBack;
  return win.history.length > 1;
}

/* ---------- the in-app trail: which page did this tab come from? ---------- */

const KEY = "nestup:nav-trail";
const MAX = 50;
const listeners = new Set<() => void>();
let trail: string[] | null = null;
let goingBack = false;

function load(): string[] {
  if (trail) return trail;
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    trail = Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    trail = [];
  }
  return trail;
}

function save(): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail));
  } catch {
    // private mode / storage blocked — the trail still lives in memory for this page
  }
  listeners.forEach((l) => l());
}

/**
 * Call on every pathname change. A visit marked as "going back" (our button or
 * the browser's) pops the trail instead of growing it, so the trail mirrors
 * the tab's history: previous page second-to-last, current page last.
 */
export function recordVisit(pathname: string): void {
  const t = load();
  if (t[t.length - 1] === pathname) {
    goingBack = false;
    return;
  }
  if (goingBack && t[t.length - 2] === pathname) t.pop();
  else t.push(pathname);
  goingBack = false;
  if (t.length > MAX) t.splice(0, t.length - MAX);
  save();
}

/** The next pathname change is a step back (button click or browser Back). */
export function markGoingBack(): void {
  goingBack = true;
}

/**
 * The in-app page before `pathname`, or null when this tab has none. Correct
 * both before and after recordVisit() has run for the current page, so the
 * label doesn't flicker while a navigation settles.
 */
export function previousVisit(pathname: string): string | null {
  const t = load();
  const last = t[t.length - 1];
  if (last === pathname) return t[t.length - 2] ?? null;
  if (goingBack && t[t.length - 2] === pathname) return t[t.length - 3] ?? null;
  return last ?? null;
}

export function subscribeTrail(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Forget the trail (tests, sign-out); the next read starts from storage again. */
export function resetTrail(): void {
  trail = null;
  goingBack = false;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

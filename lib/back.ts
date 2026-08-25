/**
 * Where "Back" goes when the browser has no in-app page to return to
 * (a deep link, a refreshed tab, a link from a chat app): the page's parent.
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

"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

const BY_TYPE = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-fade" } as const;

/**
 * Animates route changes with the browser View Transitions API (via React's
 * `<ViewTransition>`). Lives in the root layout and is keyed on the pathname
 * so every navigation — including a (public) ↔ (app) layout swap — is one
 * exit/enter pair: tab-to-tab moves tagged by the bottom nav slide left or
 * right (`.nav-forward` / `.nav-back` in globals.css); anything else — a
 * listing card, the back button — crossfades (`.page-fade`). In-place updates
 * such as `router.refresh()` never animate. Browsers without the API just
 * swap pages as before.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter={BY_TYPE} exit={BY_TYPE} default="none">
      {children}
    </ViewTransition>
  );
}

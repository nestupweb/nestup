"use client";

import { useSyncExternalStore } from "react";
import { currentTheme } from "@/components/map/basemap";

/**
 * The theme the app is showing right now, kept live.
 *
 * The toggle writes `data-theme` on <html> and the system setting can change
 * underneath us, so this subscribes to both rather than reading once on mount —
 * which is also why it's `useSyncExternalStore` and not state-in-an-effect.
 */
export function useMapTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => "light");
}

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media?.removeEventListener("change", onChange);
  };
}

/**
 * True on devices without a hover pointer — phones and tablets, where a map
 * that pans on first touch would eat the page scroll.
 */
export function useIsTouch(): boolean {
  return useSyncExternalStore(subscribeHover, () => window.matchMedia?.("(hover: none)").matches ?? false, () => false);
}

function subscribeHover(onChange: () => void): () => void {
  const media = window.matchMedia?.("(hover: none)");
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

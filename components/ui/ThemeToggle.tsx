"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Light/dark switch in the site header: a pill track with a knob that slides
 * to the right and turns from a sun into a moon. Writes the theme to
 * `<html data-theme>` (the inline head script re-applies it pre-paint on the
 * next load) and to localStorage.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useLayoutEffect(() => {
    // Sync from the <html> attribute the inline head script sets pre-paint; a lazy
    // initializer would mismatch the server-rendered state during hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.theme = next ? "dark" : "light";
    } catch {}
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        dark ? "border-accent bg-accent" : "border-hairline bg-hairline hover:border-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded-full bg-surface text-accent shadow-[0_2px_6px_-1px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out ${
          dark ? "translate-x-5" : "translate-x-0"
        }`}
      >
        {dark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Sync from the <html> attribute the inline head script sets pre-paint; a lazy
    // initializer would mismatch the server-rendered label during hydration.
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
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium tracking-wide text-muted hover:text-ink"
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}

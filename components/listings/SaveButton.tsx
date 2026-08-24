"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "nestup:saved-listings";

function readSaved(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Same-tab updates flow through this emitter; the "storage" event covers other tabs.
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Per-viewer favorite toggle, persisted in localStorage only (no DB table yet —
 * see docs/superpowers/notes/handoff-notes.md). Server snapshot is "unsaved",
 * so SSR and hydration agree; the real value syncs in on the client.
 */
export function SaveButton({ listingId, className = "" }: { listingId: string; className?: string }) {
  const saved = useSyncExternalStore(
    subscribe,
    () => readSaved().includes(listingId),
    () => false
  );

  function toggle() {
    try {
      const ids = new Set(readSaved());
      if (ids.has(listingId)) ids.delete(listingId);
      else ids.add(listingId);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      // Storage blocked (private mode, etc.) — nothing to persist.
    }
    emit();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved rooms" : "Save this room"}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface/90 backdrop-blur transition-colors ${
        saved ? "text-accent" : "text-muted hover:text-ink"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}

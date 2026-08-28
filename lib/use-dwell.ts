"use client";

import { useEffect, useRef } from "react";
import { DWELL_CAP_MS } from "@/lib/affinity";

/** No interaction for this long and the clock stops — an abandoned tab is not interest. */
export const IDLE_MS = 10_000;
/** How often the clock is checked. Fine-grained enough for a 1.5 s floor. */
const TICK_MS = 250;

/**
 * Measures how long the seeker was *actually* looking at one card.
 *
 * Four things are deliberately not counted, because each would otherwise let a
 * forgotten tab teach the ranker nonsense:
 *  - time while the tab is hidden (`visibilityState`),
 *  - time while the window has lost focus (`document.hasFocus()`),
 *  - time after `IDLE_MS` with no pointer, key, wheel or touch activity,
 *  - anything beyond `DWELL_CAP_MS` on a single card.
 *
 * `onFlush` fires exactly once per card — when `key` changes, on unmount, or on
 * `pagehide` if the seeker closes the tab mid-card. The caller decides whether
 * the reading is worth storing.
 *
 * The key is handed back with the reading because the flush lands *after* the
 * deck has already advanced: by then the caller's idea of "the current card" is
 * the next one, and attributing the time to it would be wrong.
 */
export function useDwell(key: string | null, onFlush: (key: string, activeMs: number) => void): void {
  // Held in a ref so a changing callback never restarts the measurement.
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  useEffect(() => {
    if (!key) return;

    let accrued = 0;
    let lastInteraction = Date.now();
    let lastTick = Date.now();
    let done = false;

    const note = () => {
      lastInteraction = Date.now();
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const event of events) window.addEventListener(event, note, { passive: true });

    const timer = window.setInterval(() => {
      const now = Date.now();
      // Clamped: a throttled background tab can hand back a delta of minutes,
      // and if the seeker touches the screen on return the idle guard would
      // pass and that whole gap would be banked as attention.
      const delta = Math.min(now - lastTick, TICK_MS * 2);
      lastTick = now;
      const active =
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        now - lastInteraction < IDLE_MS;
      if (active) accrued = Math.min(DWELL_CAP_MS, accrued + delta);
    }, TICK_MS);

    const flush = () => {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      onFlushRef.current(key, Math.round(accrued));
    };

    window.addEventListener("pagehide", flush);

    return () => {
      window.removeEventListener("pagehide", flush);
      for (const event of events) window.removeEventListener(event, note);
      flush();
    };
  }, [key]);
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards — for anything that depends on the viewer's clock. */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * The viewer's clock as an external store: 0 during SSR/hydration (treat as
 * "unknown"), then the current time rounded down to `intervalMs`, re-read on
 * every tick — so time-based UI (an upcoming viewing's ring) expires on its
 * own without a re-render from the server.
 */
export function useNow(intervalMs = 60_000): number {
  const subscribe = useCallback(
    (onTick: () => void) => {
      const timer = setInterval(onTick, intervalMs);
      return () => clearInterval(timer);
    },
    [intervalMs]
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0
  );
}

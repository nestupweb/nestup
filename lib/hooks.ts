"use client";

import { startTransition, useActionState, useCallback, useSyncExternalStore, type FormEvent } from "react";

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

/**
 * `useActionState`, without React 19's automatic form reset.
 *
 * React clears an uncontrolled form as soon as a form action returns — fine
 * when the answer is "saved", ruinous when it is "you missed the city field":
 * everything already typed goes with it. Submitting the same FormData
 * ourselves skips that reset, so a rejected form comes back exactly as the
 * member left it, with the error above the button.
 *
 * Spread the second value onto the form: `<form {...form}>`. The `action`
 * stays on it as the no-JS fallback — without JavaScript the browser posts
 * natively and nothing here runs.
 */
export function useStickyForm<S>(
  action: (prev: Awaited<S>, data: FormData) => S | Promise<S>,
  initial: Awaited<S>
): [Awaited<S>, { action: (data: FormData) => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void }, boolean] {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial);
  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      // A named submit button is part of the submission; carry it over too.
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.name) data.append(submitter.name, submitter.value);
      startTransition(() => dispatch(data));
    },
    [dispatch]
  );
  return [state, { action: dispatch, onSubmit }, pending];
}

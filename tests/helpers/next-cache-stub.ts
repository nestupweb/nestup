import { vi } from "vitest";

/**
 * A stand-in for `next/cache` in unit tests.
 *
 * These functions only work inside a request Next is rendering, so any test
 * that imports a Server Action has to replace the module wholesale. That was
 * being done per file with a hand-written literal listing whichever exports the
 * action happened to use that week — which is why swapping `revalidatePath` for
 * `refresh` in the actions turned eleven tests red at once with
 * `No "refresh" export is defined on the "next/cache" mock`. The failures said
 * nothing about the change being wrong; the mocks had simply gone out of date.
 *
 * Declaring the whole surface in one place means adding a cache primitive to an
 * action never breaks an unrelated test again. A test that wants to *assert*
 * on the calls should still define its own spies — see
 * `tests/unit/cache-invalidation.test.ts`, which checks the exact set of tags a
 * mutation invalidates.
 *
 * Vitest isolates the module registry per test file, so the spies below are
 * fresh in each one and cannot leak across files.
 */
export const revalidatePath = vi.fn();
export const revalidateTag = vi.fn();
export const updateTag = vi.fn();
export const refresh = vi.fn();
export const cacheTag = vi.fn();
export const cacheLife = vi.fn();
export const unstable_cache = vi.fn(<T>(fn: T) => fn);

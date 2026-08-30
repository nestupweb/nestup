import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * Known-red, and not from anything in the app: `tests/unit/theme-toggle.test.tsx`
 * fails both its cases with `localStorage.clear is not a function`.
 *
 * Node 25 ships a `localStorage` global gated behind `--localstorage-file`, and
 * Vitest passes that flag with no path (see the warnings the run prints), so the
 * global exists but is inert — and jsdom's working implementation does not
 * replace it. Aliasing `globalThis.localStorage` to `window.localStorage` here
 * does NOT fix it: jsdom's own is the inert one in this combination, so the fix
 * is a Vitest/Node version move rather than a line of setup. Left documented
 * rather than papered over, so the next person does not re-derive it.
 */

// next/font/google is a build-time macro Next compiles away; Vitest can't, so stub every font loader.
// `has` must report every prop as present (Vitest checks `prop in mock` before reading a named
// export), and `get` must not answer "then" with a function, or Vitest's mock resolver mistakes
// the Proxy for a thenable, calls it, and silently discards the mock.
vi.mock("next/font/google", () => new Proxy({}, {
  get: (_target, prop) => (prop === "then" ? undefined : () => ({ variable: "", className: "" })),
  has: () => true,
}));

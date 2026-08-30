import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * Run the suite with `npm test`, never a bare `npx vitest run`.
 *
 * The npm script sets `NODE_OPTIONS=--no-experimental-webstorage`, and it is
 * load-bearing: without it Node 25 installs its own `localStorage` global, gated
 * behind `--localstorage-file` and inert when Vitest passes that flag with no
 * path. jsdom's working implementation does not replace it, so
 * `theme-toggle.test.tsx` fails both cases with `localStorage.clear is not a
 * function` — a failure that says nothing about the component and appears only
 * when the npm script is bypassed.
 */

// next/font/google is a build-time macro Next compiles away; Vitest can't, so stub every font loader.
// `has` must report every prop as present (Vitest checks `prop in mock` before reading a named
// export), and `get` must not answer "then" with a function, or Vitest's mock resolver mistakes
// the Proxy for a thenable, calls it, and silently discards the mock.
vi.mock("next/font/google", () => new Proxy({}, {
  get: (_target, prop) => (prop === "then" ? undefined : () => ({ variable: "", className: "" })),
  has: () => true,
}));

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * Point the bare `localStorage` global at jsdom's, which is the one the tests
 * and the browser both mean.
 *
 * Node 25 ships its own `localStorage` global, gated behind `--localstorage-file`.
 * Vitest passes that flag without a path, so the global exists but is inert —
 * hence `localStorage.clear is not a function`. Because Node installs it as a
 * non-writable global, jsdom's working implementation never replaced it, and
 * anything reading the bare identifier (`ThemeToggle` included, exactly as it
 * does in a real browser) got the dud instead of the store the assertions read.
 * Redefining it here rather than rewriting call sites keeps the components
 * under test written the way they ship.
 */
Object.defineProperty(globalThis, "localStorage", {
  value: window.localStorage,
  configurable: true,
  writable: true,
});

// next/font/google is a build-time macro Next compiles away; Vitest can't, so stub every font loader.
// `has` must report every prop as present (Vitest checks `prop in mock` before reading a named
// export), and `get` must not answer "then" with a function, or Vitest's mock resolver mistakes
// the Proxy for a thenable, calls it, and silently discards the mock.
vi.mock("next/font/google", () => new Proxy({}, {
  get: (_target, prop) => (prop === "then" ? undefined : () => ({ variable: "", className: "" })),
  has: () => true,
}));

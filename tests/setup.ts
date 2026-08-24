import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// next/font/google is a build-time macro Next compiles away; Vitest can't, so stub every font loader.
// `has` must report every prop as present (Vitest checks `prop in mock` before reading a named
// export), and `get` must not answer "then" with a function, or Vitest's mock resolver mistakes
// the Proxy for a thenable, calls it, and silently discards the mock.
vi.mock("next/font/google", () => new Proxy({}, {
  get: (_target, prop) => (prop === "then" ? undefined : () => ({ variable: "", className: "" })),
  has: () => true,
}));

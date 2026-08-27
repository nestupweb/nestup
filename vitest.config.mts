import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // Next resolves this marker itself; Vitest needs a file to point at.
      "server-only": `${import.meta.dirname}/tests/stubs/server-only.ts`,
    },
  },
});

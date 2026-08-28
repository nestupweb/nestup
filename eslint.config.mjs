import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // MapLibre's own worker bundle, copied in by scripts/copy-maplibre-worker.mjs.
    "public/maplibre/**",
  ]),
  {
    // components/ui/map.tsx is mapcn's map component, copied in from its
    // shadcn registry (https://www.mapcn.dev/r/map.json) and edited only where
    // this app's palette required it. It writes refs during render and syncs a
    // style swap through state in an effect — both fine for a library binding
    // a non-React map, both flagged by the React-compiler rules this repo runs
    // over its own code. Muting them here keeps the file close enough to
    // upstream that it can be re-pulled.
    files: ["components/ui/map.tsx"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

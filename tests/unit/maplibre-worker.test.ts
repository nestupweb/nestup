import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const root = join(import.meta.dirname, "../..");

/** Kept in step with scripts/copy-maplibre-worker.mjs by hand — there are two. */
const WORKER_FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

/**
 * The map loads its worker from our own origin (see components/ui/map.tsx),
 * which only works while the copies in public/ match the installed library.
 * `npm run maplibre:worker` refreshes them; this catches a version bump that
 * was committed without them.
 */
test("the served worker matches the installed maplibre-gl", () => {
  for (const file of WORKER_FILES) {
    const installed = readFileSync(join(root, "node_modules/maplibre-gl/dist", file));
    const served = readFileSync(join(root, "public/maplibre", file));
    expect(served.equals(installed), `public/maplibre/${file} is stale — run npm run maplibre:worker`).toBe(true);
  }
});

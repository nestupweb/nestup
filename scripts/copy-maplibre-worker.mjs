/**
 * Copies MapLibre's worker into public/maplibre so the map runs entirely on
 * our own origin.
 *
 * MapLibre 6 loads its worker as a separate module, resolved relative to the
 * bundle it came from — a path that doesn't exist once Next has bundled the
 * library into a hashed chunk. mapcn's answer is to point the worker at
 * unpkg.com; ours is to serve the two files ourselves (see WORKER_URL in
 * components/ui/map.tsx), so the app doesn't depend on a third-party CDN
 * staying up to draw a map.
 *
 * Run it by hand after upgrading maplibre-gl (`npm run maplibre:worker`) — not
 * from `prebuild`, because `.vercelignore` keeps /scripts off the deploy, so a
 * build step here would only fail on Vercel. The copies are committed, which
 * is what the deploy and `next dev` actually use, and
 * `tests/unit/maplibre-worker.test.ts` fails if they drift from the installed
 * version.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");

const WORKER_FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

mkdirSync(to, { recursive: true });
for (const file of WORKER_FILES) {
  copyFileSync(join(from, file), join(to, file));
  console.log(`maplibre worker → public/maplibre/${file}`);
}

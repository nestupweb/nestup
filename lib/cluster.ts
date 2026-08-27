
import type { LatLng } from "@/lib/geo";

/**
 * Grid clustering for the results map.
 *
 * Two hundred pins on one screen is a smear, so rooms that fall within roughly
 * `cellPx` screen pixels of each other are drawn as a single numbered circle
 * that splits as you zoom in. Doing it on a grid — rather than pulling in a
 * clustering plugin — keeps this pure, instant for our numbers, and testable
 * without a browser.
 */

/** Anything with a position; the map's pins carry a listing alongside. */
export interface Positioned {
  lat: number;
  lng: number;
}

export interface Cluster<T extends Positioned> {
  /** Where the circle sits: the average of its members. */
  lat: number;
  lng: number;
  items: T[];
  /** Stable across renders at the same zoom — used as the React key. */
  key: string;
}

/**
 * Degrees of longitude covered by one pixel at a given zoom, in the Web
 * Mercator scheme Leaflet uses (256-pixel tiles).
 */
export function degreesPerPixel(zoom: number): number {
  return 360 / (256 * 2 ** zoom);
}

/**
 * Group points into clusters no smaller than `cellPx` pixels apart.
 *
 * Latitude cells are scaled by cos(lat) so a cell stays roughly square on
 * screen — without it, clusters look stretched the further north you go.
 */
export function clusterPoints<T extends Positioned>(
  points: T[],
  zoom: number,
  cellPx = 80
): Cluster<T>[] {
  if (points.length === 0) return [];
  const cellLng = degreesPerPixel(zoom) * cellPx;
  const midLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const cellLat = cellLng * Math.max(0.2, Math.cos((midLat * Math.PI) / 180));

  const buckets = new Map<string, T[]>();
  for (const p of points) {
    const col = Math.floor(p.lng / cellLng);
    const row = Math.floor(p.lat / cellLat);
    const key = `${row}:${col}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(p);
    else buckets.set(key, [p]);
  }

  const seeded = [...buckets.entries()]
    .map(([key, items]) => ({ key, items, ...centreOf(items) }))
    .sort((a, b) => b.items.length - a.items.length);

  // A grid alone leaves circles overlapping: two neighbouring cells whose rooms
  // both hug the shared border average out to nearly the same point, and the
  // smaller circle then sits under the bigger one where nobody can click it
  // (seen live on 2026-08-27 — Tel Aviv and Ramat Gan at country zoom). So the
  // seeds are merged greedily, biggest first: any cluster whose centre lands
  // within one cell of one already kept is absorbed into it.
  const merged: Cluster<T>[] = [];
  for (const seed of seeded) {
    const host = merged.find(
      (m) => Math.hypot((m.lat - seed.lat) / cellLat, (m.lng - seed.lng) / cellLng) < 1
    );
    if (host) {
      host.items.push(...seed.items);
      const c = centreOf(host.items);
      host.lat = c.lat;
      host.lng = c.lng;
    } else {
      merged.push({ ...seed });
    }
  }

  // Biggest clusters first so a small pin never paints over a big circle.
  return merged.sort((a, b) => b.items.length - a.items.length);
}

function centreOf<T extends Positioned>(items: T[]): LatLng {
  if (items.length === 1) return { lat: items[0].lat, lng: items[0].lng };
  return {
    lat: items.reduce((s, p) => s + p.lat, 0) / items.length,
    lng: items.reduce((s, p) => s + p.lng, 0) / items.length,
  };
}

/**
 * How far to zoom when someone clicks a cluster: enough to break it apart,
 * capped so a click never dives all the way to street level in one go.
 */
export function zoomIntoCluster(current: number, max = 18): number {
  return Math.min(max, current + 2);
}

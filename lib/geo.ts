import type { CoordsSource, Listing } from "@/lib/types";

/** A point on the map. Latitude first, the way people say it out loud. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Rectangle covering a set of points, as Leaflet wants it. */
export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Metres per degree of latitude (near enough anywhere on Earth). */
const M_PER_DEG_LAT = 111_320;

/** Metres per degree of longitude shrinks towards the poles. */
function mPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/**
 * Deterministic 0…1 from a string — same key always gives the same number, so
 * a room's blurred position and a demo room's scatter never move between
 * renders, servers or test runs. (FNV-1a, 32-bit.)
 */
export function hashUnit(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0xffffffff;
}

/**
 * Move a point to a fixed offset inside `radius` metres, chosen by `key`.
 *
 * Used by the seeding scripts to spread rooms that share a street, and to
 * place a room whose address can't be found near its city centre. Repeatable,
 * so a room never appears to jump between runs, and evenly spread rather than
 * bunched in the middle (hence the square root on the radius).
 */
export function scatter(centre: LatLng, key: string, radius: number): LatLng {
  const angle = hashUnit(`${key}:angle`) * 2 * Math.PI;
  const distance = Math.sqrt(hashUnit(`${key}:dist`)) * radius;
  const lat = centre.lat + (distance * Math.sin(angle)) / M_PER_DEG_LAT;
  const lng = centre.lng + (distance * Math.cos(angle)) / mPerDegLng(centre.lat || 1);
  return { lat: round(lat), lng: round(lng) };
}

/** Six decimals ≈ 10 cm — far more than we need, and keeps JSON small. */
function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** A listing's point, or null when it has none yet. */
export function pointOf(listing: Pick<Listing, "lat" | "lng">): LatLng | null {
  const { lat, lng } = listing;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

/** Precedence: a pin the owner placed is never overwritten by a later geocode. */
export function shouldGeocode(current: CoordsSource, addressChanged: boolean): boolean {
  if (current === "owner") return false;
  return addressChanged || current === "none" || current === "city";
}

/** Rectangle around a set of points, padded a little so pins aren't on the edge. */
export function boundsOf(points: LatLng[], padDeg = 0.01): Bounds | null {
  if (points.length === 0) return null;
  let south = points[0].lat;
  let north = points[0].lat;
  let west = points[0].lng;
  let east = points[0].lng;
  for (const p of points) {
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
  }
  return {
    south: south - padDeg,
    west: west - padDeg,
    north: north + padDeg,
    east: east + padDeg,
  };
}

/** Great-circle distance in metres — used to keep a geocode near its city. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * M_PER_DEG_LAT;
  const dLng = (b.lng - a.lng) * mPerDegLng((a.lat + b.lat) / 2);
  return Math.round(Math.hypot(dLat, dLng));
}

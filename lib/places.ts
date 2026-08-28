import type { PlaceKind } from "@/components/map/basemap";

/**
 * What's around a room — the cafés, restaurants, bars and shops a normal map
 * draws on a street.
 *
 * The basemap doesn't draw them: mapcn's cartography is CARTO Positron, which
 * is a deliberately quiet "data" basemap and shows almost no businesses. So we
 * ask OpenStreetMap for them ourselves, through Overpass — free, keyless, no
 * account — and draw them as our own pins, which has the side benefit that we
 * choose the colours and the room's own pin can't be mistaken for a café.
 *
 * Everything here is pure: building the query and reading the answer are
 * testable on their own, and `app/api/places/route.ts` does the fetching,
 * caching and failing-quietly.
 */

/** A place near a room, ready to draw. */
export interface Place {
  /** OSM type+id ("node/12345") — stable, and unique across the answer. */
  id: string;
  /** Always Latin script: the English name, or the kind when there isn't one. */
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
}

/** How far around the room to look — a ten-minute walk (user request, 2026-08-28). */
export const PLACE_RADIUS_M = 1000;

/**
 * The most pins worth drawing.
 *
 * These are DOM markers, and a busy corner of Tel Aviv can return several
 * hundred within the radius — which is both slow and unreadable. The closest
 * ones are the ones that say something about the room anyway.
 *
 * Raised with the radius: at 60 the nearest sixty in central Tel Aviv were all
 * inside the old four hundred metres, so widening the search alone would have
 * changed nothing anyone could see.
 */
export const MAX_PLACES = 150;

/** OSM `amenity` values, grouped into the four kinds the legend names. */
const AMENITIES: Record<string, PlaceKind> = {
  cafe: "cafe",
  ice_cream: "cafe",
  restaurant: "restaurant",
  fast_food: "restaurant",
  bar: "bar",
  pub: "bar",
  biergarten: "bar",
};

/** What to call a place we have no English name for. */
const KIND_NAMES: Record<PlaceKind, string> = {
  cafe: "Café",
  restaurant: "Restaurant",
  bar: "Bar",
  shop: "Shop",
};

/**
 * The Overpass query for one room's surroundings.
 *
 * `nwr` catches all three OSM element types, because a café can be mapped as a
 * point, as the outline of its building, or as a relation; `out center` gives
 * every one of them a single coordinate to pin.
 */
export function placesQuery(lat: number, lng: number): string {
  const amenities = Object.keys(AMENITIES).join("|");
  const around = `around:${PLACE_RADIUS_M},${lat},${lng}`;
  return [
    "[out:json][timeout:25];",
    "(",
    `  nwr(${around})["amenity"~"^(${amenities})$"];`,
    `  nwr(${around})["shop"];`,
    ");",
    "out center 400;",
  ].join("\n");
}

/** True for text we can print in an English-language app. */
function latin(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !/[֐-ࣿ]/.test(value);
}

type Element = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

/**
 * Overpass's answer → pins, nearest first.
 *
 * Never throws and never trusts the shape: this runs on whatever a public
 * mirror happened to return. A place we can't name in English keeps its pin
 * and is labelled by kind — the user asked for the Hebrew to go, and a
 * half-Hebrew map would be worse than an unnamed café.
 */
export function readPlaces(payload: unknown, from: { lat: number; lng: number }): Place[] {
  const elements = (payload as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];

  const seen = new Set<string>();
  const places: Place[] = [];

  for (const element of elements as Element[]) {
    const tags = element?.tags;
    if (!tags) continue;

    const kind: PlaceKind | undefined = tags.shop ? "shop" : AMENITIES[tags.amenity];
    if (!kind) continue;
    // `shop=no` and `shop=vacant` mark a unit that used to be a shop.
    if (kind === "shop" && (tags.shop === "no" || tags.shop === "vacant")) continue;

    const point = element.center ?? element;
    const lat = Number(point?.lat);
    const lng = Number(point?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const id = `${element.type ?? "node"}/${element.id ?? `${lat},${lng}`}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const named = tags["name:en"] ?? (latin(tags.name) ? tags.name : null);
    places.push({ id, name: named ?? KIND_NAMES[kind], kind, lat, lng });
  }

  return places
    .map((place) => ({ place, away: (place.lat - from.lat) ** 2 + (place.lng - from.lng) ** 2 }))
    .sort((a, b) => a.away - b.away)
    .slice(0, MAX_PLACES)
    .map((entry) => entry.place);
}

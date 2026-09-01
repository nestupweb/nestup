import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { LISTINGS_TAG, savedTag } from "@/lib/cache-tags";
import type { ListingFilters } from "@/lib/validation/filters";
import type { Listing } from "@/lib/types";

/** Minimal query surface we drive — lets unit tests fake the builder. */
export interface FilterableQuery {
  eq(column: string, value: unknown): FilterableQuery;
  not(column: string, operator: string, value: unknown): FilterableQuery;
  gte(column: string, value: unknown): FilterableQuery;
  lte(column: string, value: unknown): FilterableQuery;
  order(column: string, opts: { ascending: boolean }): FilterableQuery;
  range(from: number, to: number): FilterableQuery;
}

const BOOL_KEYS = [
  "pets_allowed", "smoking_allowed", "balcony",
  "air_conditioning", "parking", "elevator", "furnished",
] as const;

export function applyListingFilters<Q extends FilterableQuery>(q: Q, f: ListingFilters): Q {
  if (f.city) q.eq("city", f.city);
  if (f.rent_min !== undefined) q.gte("rent", f.rent_min);
  if (f.rent_max !== undefined) q.lte("rent", f.rent_max);
  if (f.move_in_by) q.lte("available_from", f.move_in_by);
  if (f.lease_term) q.eq("lease_term", f.lease_term);
  if (f.safe_room) q.eq("safe_room", f.safe_room);
  // `household_gender` was computed when the household last changed, so this
  // is one indexed lookup rather than a subquery per row (0037). Null means
  // either mixed or somebody hasn't said — neither qualifies, so an equality
  // is the whole filter.
  if (f.household_gender) q.eq("household_gender", f.household_gender);
  // The shown number, not the typed one (0042) — a "max 2 roommates" search
  // that returned cards reading "3 roommates" is the same contradiction.
  if (f.roommates_max !== undefined) q.lte("household_size", f.roommates_max);
  for (const key of BOOL_KEYS) {
    if (f[key] !== undefined) q.eq(key, f[key]);
  }
  if (f.sort === "price_asc" || f.sort === "price_desc") {
    q.order("rent", { ascending: f.sort === "price_asc" });
  }
  q.order("created_at", { ascending: false }); // tie-break (and the default order)
  const from = (f.page - 1) * f.page_size;
  q.range(from, from + f.page_size - 1);
  return q;
}

/** One dot on the results map — only what the pin and its little card need. */
export interface ListingPin {
  id: string;
  lat: number;
  lng: number;
  rent: number;
  title: string;
  city: string;
  neighborhood: string;
  photo: string | null;
}

/** How many pins the map will draw before it stops asking for more. */
export const MAX_PINS = 2000;

/**
 * Every room on the site that has a position, for the map.
 *
 * Deliberately unfiltered (user decision, 2026-08-28): the map is the
 * "everything we have" view, so the sidebar's filters don't reach it — opening
 * it while a filter is on still shows the whole country. Also deliberately
 * narrow: a pin needs eight fields, not a whole listing row.
 *
 * `is_active` and `removed_at` are filtered explicitly rather than left to RLS:
 * since migration 0027 a member linked to a room can read it even when it is
 * closed, so a query that relied on RLS alone would leak paused rooms onto
 * their map.
 */
export async function queryAllListingPins(): Promise<ListingPin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(PIN_FIELDS)
    .eq("is_active", true)
    .is("removed_at", null)
    .not("lat", "is", null)
    // Every pin on this map is at the room's own address. A room whose
    // address couldn't be placed is left off it entirely rather than drawn
    // near the middle of its city (user decision, 2026-08-28).
    .neq("coords_source", "city")
    .limit(MAX_PINS);
  if (error) return [];
  return toPins(data);
}

/**
 * How far around a room still counts as "nearby" on that room's own map.
 *
 * Ten kilometres: the map opens at street zoom, so this is well past the edge
 * of the first few zoom-outs, and in a country this size it's a metro area's
 * worth of alternatives rather than the whole map again.
 */
export const NEARBY_RADIUS_M = 10_000;

/** And how many of them the map will draw. */
export const MAX_NEARBY_PINS = 300;

/**
 * The other rooms around one room, for the map on its page.
 *
 * Same rules as the map of everything — active, not removed, placed at its own
 * address — minus the room you're already looking at, and boxed to
 * `NEARBY_RADIUS_M` so a listing page doesn't ship all eight hundred pins.
 *
 * A box rather than a circle, because it's two indexed range comparisons and
 * the corners being a few kilometres generous costs nothing: these are
 * alternatives to scroll past, not a search result.
 */
export async function queryNearbyListingPins(
  point: { lat: number; lng: number },
  excludeId: string
): Promise<ListingPin[]> {
  const supabase = await createClient();
  const dLat = NEARBY_RADIUS_M / 111_320;
  // A degree of longitude shortens towards the poles; at Israel's latitude
  // it's about 0.85 of a degree of latitude.
  const dLng = dLat / Math.max(0.2, Math.cos((point.lat * Math.PI) / 180));

  const { data, error } = await supabase
    .from("listings")
    .select(PIN_FIELDS)
    .eq("is_active", true)
    .is("removed_at", null)
    .neq("id", excludeId)
    .neq("coords_source", "city")
    .gte("lat", point.lat - dLat)
    .lte("lat", point.lat + dLat)
    .gte("lng", point.lng - dLng)
    .lte("lng", point.lng + dLng)
    .limit(MAX_NEARBY_PINS);
  if (error) return [];
  return toPins(data);
}

/** The eight columns a pin needs — nothing else is read off the row. */
const PIN_FIELDS = "id, lat, lng, rent, title, city, neighborhood, photo_urls";

/** Rows to pins, dropping anything that turned out to have no position. */
function toPins(data: unknown): ListingPin[] {
  const rows = (data ?? []) as {
    id: string;
    lat: number | null;
    lng: number | null;
    rent: number;
    title: string;
    city: string;
    neighborhood: string;
    photo_urls: string[] | null;
  }[];
  return rows
    .filter((r): r is typeof r & { lat: number; lng: number } => r.lat !== null && r.lng !== null)
    .map((r) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      rent: r.rent,
      title: r.title,
      city: r.city,
      neighborhood: r.neighborhood,
      photo: r.photo_urls?.[0] ?? null,
    }));
}

/**
 * Public browse query — RLS exposes only active listings to anon.
 *
 * Cached in the SHARED store, not the per-browser one: the result depends only
 * on `filters`, never on who is asking, so one fetch can serve every visitor
 * and the common filter combinations can be prerendered. That is only true
 * because it goes through the cookie-free `createPublicClient()` — swapping in
 * the session client would make the output member-specific and this cache a
 * cross-user leak. The hearts on the cards are per-member and are fetched
 * separately (see `getSavedListingIds`).
 *
 * Invalidated by `LISTINGS_TAG` whenever a room is published, edited, paused
 * or removed.
 */
export async function queryListings(
  filters: ListingFilters
): Promise<{ listings: Listing[]; total: number }> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const supabase = createPublicClient();
  const query = supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("is_active", true);
  applyListingFilters(query as unknown as FilterableQuery, filters);
  const { data, count, error } = await query;
  if (error) return { listings: [], total: 0 };
  return { listings: (data as Listing[]) ?? [], total: count ?? 0 };
}

/**
 * The member's saved ("liked") room ids, for the hearts on the Listings cards.
 * Private cache: it is one member's data and must never be shared, so it lives
 * in their browser's memory only and is keyed by their id.
 */
export async function getSavedListingIds(userId: string): Promise<Set<string>> {
  "use cache: private";
  cacheTag(savedTag(userId));
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const supabase = await createClient();
  const { data } = await supabase.from("saved_listings").select("listing_id").eq("user_id", userId);
  return new Set(((data as { listing_id: string }[] | null) ?? []).map((r) => r.listing_id));
}

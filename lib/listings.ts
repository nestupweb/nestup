import { createClient } from "@/lib/supabase/server";
import type { ListingFilters } from "@/lib/validation/filters";
import type { Listing } from "@/lib/types";

/** Minimal query surface we drive — lets unit tests fake the builder. */
export interface FilterableQuery {
  eq(column: string, value: unknown): FilterableQuery;
  gte(column: string, value: unknown): FilterableQuery;
  lte(column: string, value: unknown): FilterableQuery;
  order(column: string, opts: { ascending: boolean }): FilterableQuery;
  range(from: number, to: number): FilterableQuery;
}

const BOOL_KEYS = [
  "pets_allowed", "smoking_allowed", "balcony",
  "air_conditioning", "parking", "elevator", "furnished",
] as const;

export function applyListingFilters<Q extends FilterableQuery>(
  q: Q,
  f: ListingFilters,
  opts: { paginate?: boolean } = {}
): Q {
  if (f.city) q.eq("city", f.city);
  if (f.rent_min !== undefined) q.gte("rent", f.rent_min);
  if (f.rent_max !== undefined) q.lte("rent", f.rent_max);
  if (f.move_in_by) q.lte("available_from", f.move_in_by);
  if (f.lease_term) q.eq("lease_term", f.lease_term);
  if (f.roommates_max !== undefined) q.lte("roommates_count", f.roommates_max);
  for (const key of BOOL_KEYS) {
    if (f[key] !== undefined) q.eq(key, f[key]);
  }
  if (f.sort === "price_asc" || f.sort === "price_desc") {
    q.order("rent", { ascending: f.sort === "price_asc" });
  }
  q.order("created_at", { ascending: false }); // tie-break (and the default order)
  // The map wants every match at once, not one page of them.
  if (opts.paginate !== false) {
    const from = (f.page - 1) * f.page_size;
    q.range(from, from + f.page_size - 1);
  }
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
export const MAX_PINS = 1000;

/**
 * Every room matching the current filters that has a position, for the map
 * view. Deliberately not paginated — the map shows the whole result set — and
 * deliberately narrow: a pin needs eight fields, not a whole listing row.
 *
 * `is_active` and `removed_at` are filtered explicitly rather than left to RLS:
 * since migration 0027 a member linked to a room can read it even when it is
 * closed, so a query that relied on RLS alone would leak paused rooms onto
 * their map.
 */
export async function queryListingPins(filters: ListingFilters): Promise<ListingPin[]> {
  const supabase = await createClient();
  const query = supabase
    .from("listings")
    .select("id, lat, lng, rent, title, city, neighborhood, photo_urls")
    .eq("is_active", true)
    .is("removed_at", null)
    .not("lat", "is", null)
    .limit(MAX_PINS);
  applyListingFilters(query as unknown as FilterableQuery, filters, { paginate: false });
  const { data, error } = await query;
  if (error) return [];
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

/** Public browse query — RLS exposes only active listings to anon. */
export async function queryListings(
  filters: ListingFilters
): Promise<{ listings: Listing[]; total: number }> {
  const supabase = await createClient();
  const query = supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("is_active", true);
  applyListingFilters(query as unknown as FilterableQuery, filters);
  const { data, count, error } = await query;
  if (error) return { listings: [], total: 0 };
  return { listings: (data as Listing[]) ?? [], total: count ?? 0 };
}

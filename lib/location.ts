import type { SupabaseClient } from "@supabase/supabase-js";
import type { Listing, Profile } from "@/lib/types";

/**
 * Who may see a room's exact position rather than the neighbourhood circle.
 *
 * The household — the owner and whoever lives there — and any seeker already in
 * a conversation about that room. Everyone else, signed in or not, sees the
 * approximate circle: a public listing page should not hand a stranger's front
 * door to the whole internet (user decision, 2026-08-27).
 *
 * A missed lookup means "not allowed", so the failure mode is the private one.
 */
export async function canSeeExactLocation(
  supabase: SupabaseClient,
  listing: Pick<Listing, "id" | "owner_id">,
  userId: string | undefined,
  residents: Pick<Profile, "user_id">[] = []
): Promise<boolean> {
  if (!userId) return false;
  if (userId === listing.owner_id) return true;
  if (residents.some((r) => r.user_id === userId)) return true;

  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("seeker_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * The line under the map. It says plainly how precise the dot is, so nobody
 * plans a trip around a city-centre fallback.
 */
export function locationNote(
  listing: Pick<Listing, "city" | "street" | "neighborhood" | "coords_source">,
  exact: boolean
): string {
  if (listing.coords_source === "city") {
    return `Somewhere in ${listing.city} — this room hasn't been placed at a street address, so the map shows the area only.`;
  }
  if (exact) {
    const where = [listing.street, listing.neighborhood].filter(Boolean).join(", ");
    return where ? `Exact location — ${where}, ${listing.city}.` : `Exact location in ${listing.city}.`;
  }
  return "Approximate area. The exact address appears once you're chatting about this room.";
}

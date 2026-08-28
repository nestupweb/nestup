import type { Listing } from "@/lib/types";

/**
 * The line under a room's map.
 *
 * Every room is pinned at its own address (user decision, 2026-08-28: this is
 * a demo, so the map shows the real spot rather than the neighbourhood circle
 * it used to draw). The note's job is now to say *how* the pin got there, so a
 * room whose address couldn't be found isn't mistaken for a precise one.
 */
export function locationNote(
  listing: Pick<Listing, "city" | "street" | "house_number" | "address" | "neighborhood" | "coords_source">
): string {
  if (listing.coords_source === "city") {
    return `Approximate — this room's address couldn't be placed, so the pin sits near the middle of ${listing.city}.`;
  }
  // `address` is the whole thing ("Florentin 54"); the listing form splits the
  // same into street + number. Either way the house number belongs in the line.
  const street = [listing.street, listing.house_number].filter(Boolean).join(" ").trim() || listing.address || "";
  const parts = [street, listing.neighborhood, listing.city].filter(Boolean);
  // A room on Florentin street in Florentin shouldn't read "Florentin, Florentin".
  const seen = new Set<string>();
  const line = parts.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return `${line.join(", ")}.`;
}

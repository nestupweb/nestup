import type { Listing } from "@/lib/types";

/**
 * Where the room is, in words — the line beside the map icon.
 *
 * It used to have a second job: owning up when the pin was only the city
 * centre. That case no longer exists (user decision, 2026-08-28) — a room is
 * either pinned at its own address or has no map at all — so this is now just
 * the address, tidied.
 */
export function locationNote(
  listing: Pick<Listing, "city" | "street" | "house_number" | "address" | "neighborhood">
): string {
  // `address` is the whole thing ("Florentin 54"); the listing form splits the
  // same into street + number. Either way the house number belongs in the line.
  const street = [listing.street, listing.house_number].filter(Boolean).join(" ").trim() || listing.address || "";
  // A room on Florentin street in Florentin shouldn't read "Florentin, Florentin".
  const streetName = street.replace(/\s+\d+\s*$/, "").trim().toLowerCase();
  const quarter = listing.neighborhood && listing.neighborhood.toLowerCase() !== streetName ? listing.neighborhood : "";
  return `${[street, quarter, listing.city].filter(Boolean).join(", ")}.`;
}

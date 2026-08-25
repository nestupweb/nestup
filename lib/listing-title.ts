import { propertyTypeLabel } from "@/lib/constants";
import type { PropertyType } from "@/lib/types";

/**
 * Listings no longer have a hand-written title; one is derived from the
 * essentials so cards, chats and the deck still have a short name:
 *   "Room in a 3.5-room apartment in Florentin"
 *   "Studio in Ir Yamim"
 * Always 5–80 characters (the DB check).
 */
export function buildListingTitle(input: {
  property_type: PropertyType;
  rooms: number;
  neighborhood?: string;
  city: string;
}): string {
  const place = (input.neighborhood ?? "").trim() || input.city;
  const type = propertyTypeLabel(input.property_type).toLowerCase();
  const rooms = Number.isInteger(input.rooms) ? String(input.rooms) : input.rooms.toFixed(1);
  const article = /^(8|11|18)/.test(rooms) ? "an" : "a"; // "a 3-room", "an 8-room"
  const base =
    input.property_type === "studio" ? `Studio in ${place}` : `Room in ${article} ${rooms}-room ${type} in ${place}`;
  const title = base.length > 80 ? `${base.slice(0, 79).trimEnd()}…` : base;
  return title.length >= 5 ? title : `Room in ${input.city}`;
}

import type { Listing } from "@/lib/types";

/**
 * The photo that shows the room actually up for rent: the first picture the
 * host tagged as "bedroom" (`photo_labels` runs parallel to `photo_urls`).
 * Falls back to the cover photo — seed rooms and older listings carry no
 * labels yet — and to `null` when the listing has no photos at all.
 */
export function roomPhoto(listing: Pick<Listing, "photo_urls" | "photo_labels">): { url: string; isBedroom: boolean } | null {
  const labels = listing.photo_labels ?? [];
  const i = labels.findIndex((l) => l === "bedroom");
  if (i >= 0 && listing.photo_urls[i]) return { url: listing.photo_urls[i], isBedroom: true };
  return listing.photo_urls[0] ? { url: listing.photo_urls[0], isBedroom: false } : null;
}

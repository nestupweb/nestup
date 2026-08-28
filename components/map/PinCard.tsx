"use client";

import Link from "next/link";
import type { ListingPin } from "@/lib/listings";

/**
 * The little card behind a room's pin.
 *
 * Shared by both maps so a pin behaves the same wherever it's clicked: on
 * Listings, and on a single room's map where the red pins are the rooms nearby.
 */
export function PinCard({ listing }: { listing: ListingPin }) {
  return (
    <Link href={`/browse/${listing.id}`} className="block no-underline">
      {listing.photo ? (
        // Plain <img>: this markup is portalled into MapLibre's popup, outside
        // Next's layout pass, so next/image's sizing would fight it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.photo} alt="" className="h-24 w-full rounded-lg object-cover" loading="lazy" />
      ) : null}
      <span className="mt-2 block">
        <span className="block text-sm font-bold text-ink">
          ₪{listing.rent.toLocaleString()}
          <span className="font-normal text-muted"> /mo</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {listing.city}
          {listing.neighborhood ? ` · ${listing.neighborhood}` : ""}
        </span>
        <span className="mt-1.5 block text-xs font-semibold text-accent">View room →</span>
      </span>
    </Link>
  );
}

import Link from "next/link";
import Image from "next/image";
import { NoPhoto } from "@/components/listings/NoPhoto";
import { SaveButton } from "@/components/listings/SaveButton";
import type { Listing } from "@/lib/types";

/**
 * Compact image-first card for profile grids (My Listings / Liked / History).
 * `heart` adds the like toggle in the photo's top-right corner (Profile ›
 * Liked): filled = liked, tap to unlike, tap again to like back — the same
 * SaveButton as on listing pages, so every heart agrees.
 */
export function PropertyTile({
  listing,
  badge,
  caption,
  heart,
}: {
  listing: Listing;
  badge?: string;
  caption?: string;
  heart?: { signedIn: boolean; saved: boolean };
}) {
  const photo = listing.photo_urls[0];
  return (
    <div className="group relative min-w-0">
      <Link href={`/browse/${listing.id}`} className="block min-w-0">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-hairline">
          {photo ? (
            <Image
              src={photo}
              alt=""
              fill
              sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <NoPhoto />
          )}
          {badge ? (
            <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink backdrop-blur">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-2 truncate text-[16px] leading-tight text-ink sm:text-base">
          {listing.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          ₪{listing.rent.toLocaleString()} · {listing.city}
        </p>
        {caption ? <p className="mt-0.5 truncate text-[12px] text-muted">{caption}</p> : null}
      </Link>
      {heart ? (
        // A sibling of the link, not a child: a button inside an anchor is invalid and would navigate.
        <SaveButton listingId={listing.id} signedIn={heart.signedIn} initialSaved={heart.saved} className="absolute right-2 top-2 z-[2]" />
      ) : null}
    </div>
  );
}

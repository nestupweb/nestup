import Link from "next/link";
import Image from "next/image";
import { NoPhoto } from "@/components/listings/NoPhoto";
import type { Listing } from "@/lib/types";

/** Compact image-first card for profile grids (My Listings / Liked / History). */
export function PropertyTile({
  listing,
  badge,
  caption,
}: {
  listing: Listing;
  badge?: string;
  caption?: string;
}) {
  return (
    <Link href={`/browse/${listing.id}`} className="group block min-w-0">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-hairline">
        {listing.photo_urls[0] ? (
          <Image
            src={listing.photo_urls[0]}
            alt=""
            fill
            sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <NoPhoto />
        )}
        {badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink backdrop-blur">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 truncate font-serif text-[15px] leading-tight text-ink sm:text-base">
        {listing.title}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted">
        ₪{listing.rent.toLocaleString()} · {listing.city}
      </p>
      {caption ? <p className="mt-0.5 truncate text-[11px] text-muted">{caption}</p> : null}
    </Link>
  );
}

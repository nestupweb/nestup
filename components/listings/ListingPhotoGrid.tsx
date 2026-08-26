import Link from "next/link";
import Image from "next/image";
import { photoRoomLabel } from "@/lib/constants";
import type { Listing } from "@/lib/types";

/**
 * Every photo of a listing with the room it shows written underneath
 * (from `photo_labels`, which runs parallel to `photo_urls`; untagged photos —
 * seed rooms, pre-tagging listings — get no caption), then a button to the
 * listing page. Used on member pages so a roommate's profile shows the whole
 * post, not just a cover.
 */
export function ListingPhotoGrid({ listing }: { listing: Listing }) {
  const labels = listing.photo_labels ?? [];
  return (
    <div>
      {listing.photo_urls.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {listing.photo_urls.map((url, i) => {
            const label = labels[i] ? photoRoomLabel(labels[i]) : "";
            return (
              <li key={url}>
                <figure>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-hairline">
                    <Image
                      src={url}
                      alt={label ? `${label} — ${listing.title}` : listing.title}
                      fill
                      sizes="(min-width: 640px) 33vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                  {label ? (
                    <figcaption className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</figcaption>
                  ) : null}
                </figure>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="mt-4 truncate text-base text-ink">{listing.title}</p>
      <p className="mt-0.5 text-sm text-muted">
        ₪{listing.rent.toLocaleString()} / mo · {listing.city}
      </p>
      <Link
        href={`/browse/${listing.id}`}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast transition-opacity hover:opacity-90 sm:w-auto"
      >
        View listing
      </Link>
    </div>
  );
}

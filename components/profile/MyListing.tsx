import Image from "next/image";
import Link from "next/link";
import { PencilIcon } from "@/components/ui/PencilIcon";
import { photoRoomLabel } from "@/lib/constants";
import type { Listing } from "@/lib/types";

const GRID = "grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5";
const DASHED =
  "flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline text-muted transition-colors hover:border-accent hover:text-accent";
const DASHED_LABEL = "text-[11px] font-semibold uppercase tracking-widest";
const EDIT_BUTTON =
  "mt-4 inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent";
const PENCIL =
  "absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface/95 text-ink opacity-0 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)] backdrop-blur transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";

/** The listing form, scrolled to its Photos section. */
export const EDIT_PHOTOS_HREF = "/listing#photos";

/**
 * The owner's "My listing" tab. Without a listing: one dashed square that
 * starts the listing form. With one: every photo side by side, each with a
 * pencil (on hover; always visible on touch screens) that opens the form at
 * its Photos section — and an "Edit photos" button under the grid that goes to
 * the same place, for anyone who never finds the pencil. Other members never
 * see this — /people/[id] has its own listing section.
 */
export function MyListing({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <div className={GRID}>
        <Link href="/listing" className={DASHED}>
          <span className="text-3xl font-light leading-none">+</span>
          <span className={DASHED_LABEL}>Add listing</span>
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {listings.map((listing) => (
        <ListingPhotos key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

function ListingPhotos({ listing }: { listing: Listing }) {
  const photos = listing.photo_urls ?? [];
  const labels = listing.photo_labels ?? [];
  return (
    <section aria-label={listing.title}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href={`/browse/${listing.id}`}
          className="text-[16px] font-medium text-ink underline-offset-4 hover:text-accent hover:underline"
        >
          {listing.title}
        </Link>
        <span className="text-xs text-muted">
          ₪{listing.rent.toLocaleString()} · {listing.city}
        </span>
        {!listing.is_active ? (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Paused
          </span>
        ) : null}
      </div>

      <div className={`${GRID} mt-3`}>
        {photos.map((url, i) => {
          const room = labels[i] ? photoRoomLabel(labels[i]) : "";
          return (
            <figure key={`${url}-${i}`} className="min-w-0">
              <div className="group relative aspect-square overflow-hidden rounded-xl bg-hairline">
                <Image
                  src={url}
                  alt={room ? `${room} — ${listing.title}` : `Photo ${i + 1} — ${listing.title}`}
                  fill
                  sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 33vw"
                  className="object-cover"
                />
                <Link href={EDIT_PHOTOS_HREF} aria-label={`Edit photo ${i + 1}`} className={PENCIL}>
                  <PencilIcon />
                </Link>
              </div>
              {room ? (
                <figcaption className="mt-1.5 truncate text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {room}
                </figcaption>
              ) : null}
            </figure>
          );
        })}
        {photos.length === 0 ? (
          <Link href={EDIT_PHOTOS_HREF} className={DASHED}>
            <span className="text-3xl font-light leading-none">+</span>
            <span className={DASHED_LABEL}>Add photos</span>
          </Link>
        ) : null}
      </div>

      {photos.length > 0 ? (
        <Link href={EDIT_PHOTOS_HREF} className={EDIT_BUTTON}>
          <PencilIcon />
          Edit photos
        </Link>
      ) : null}
    </section>
  );
}

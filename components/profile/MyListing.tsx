import Image from "next/image";
import Link from "next/link";
import { MarkTaken } from "@/components/listings/MarkTaken";
import { ListingActions } from "@/components/profile/ListingActions";
import { CoPosterInvites } from "@/components/profile/CoPosterInvites";
import { SharedListingSync } from "@/components/profile/SharedListingSync";
import { PencilIcon } from "@/components/ui/PencilIcon";
import { photoRoomLabel } from "@/lib/constants";
import type { PendingInvite } from "@/lib/co-posters";
import type { Listing } from "@/lib/types";

const GRID = "grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5";
const DASHED =
  "flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline text-muted transition-colors hover:border-accent hover:text-accent";
const DASHED_LABEL = "text-[11px] font-semibold uppercase tracking-widest";
const PENCIL =
  "absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface/95 text-ink opacity-0 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)] backdrop-blur transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";
const BADGE =
  "rounded-full border border-hairline px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted";

/** The listing form, scrolled to its Photos section. */
export const EDIT_PHOTOS_HREF = "/listing#photos";

/**
 * The member's "My Listings" tab, in the order things need answering:
 *
 *   1. invitations waiting on them — someone tagged them as a co-poster;
 *   2. the room they host, with the buttons that manage it;
 *   3. the rooms they co-post — shared listings they confirmed.
 *
 * A co-posted room carries the SAME buttons as one they host (0033): a
 * confirmed roommate edits, closes, re-opens and deletes the room exactly as its
 * creator does, because it is one record and they co-own it. The "Co-poster"
 * badge says whose name is on it, not what they are allowed to do.
 * Other members never see this tab — /people/[id] has its own listing section.
 */
export function MyListing({
  listings,
  invites = [],
  shared = [],
}: {
  listings: Listing[];
  /** Unanswered co-poster invitations. */
  invites?: PendingInvite[];
  /** Rooms this member confirmed as a co-poster (never their own). */
  shared?: Listing[];
}) {
  // Every room this member co-owns, so a change by any of them lands here live.
  const managedIds = [...listings, ...shared].map((l) => l.id);

  return (
    <div className="space-y-8">
      <SharedListingSync listingIds={managedIds} />
      <CoPosterInvites invites={invites} />

      {listings.length === 0 ? (
        <div className={GRID}>
          <Link href="/listing" className={DASHED}>
            <span className="text-3xl font-light leading-none">+</span>
            <span className={DASHED_LABEL}>Add listing</span>
          </Link>
        </div>
      ) : (
        listings.map((listing) => <ListingPhotos key={listing.id} listing={listing} />)
      )}

      {shared.length > 0 ? (
        <section className="border-t border-hairline pt-6">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">Shared with you</h3>
          <div className="mt-5 space-y-8">
            {shared.map((listing) => (
              <ListingPhotos key={listing.id} listing={listing} coPoster />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ListingPhotos({ listing, coPoster = false }: { listing: Listing; coPoster?: boolean }) {
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
        {coPoster ? <span className={BADGE}>Co-poster</span> : null}
        {!listing.is_active ? (
          <span className={BADGE}>{listing.taken_at ? "Taken" : "Paused"}</span>
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

      {/* Every confirmed roommate manages the room, creator or not (0033). */}
      {photos.length > 0 ? (
        <ListingActions listingId={listing.id} editHref={EDIT_PHOTOS_HREF}>
          <MarkTaken listingId={listing.id} title={listing.title} takenAt={listing.taken_at} />
        </ListingActions>
      ) : (
        <div className="mt-4">
          <MarkTaken listingId={listing.id} title={listing.title} takenAt={listing.taken_at} />
        </div>
      )}
    </section>
  );
}

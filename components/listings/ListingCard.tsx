import Link from "next/link";
import Image from "next/image";
import { FEATURES, propertyTypeLabel } from "@/lib/constants";
import { SaveButton } from "@/components/listings/SaveButton";
import type { Listing } from "@/lib/types";

function NoPhoto() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 border-r border-hairline bg-surface text-muted">
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 opacity-60"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9v12h14V9" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
      <span className="text-[10px] font-medium uppercase tracking-widest">No photo yet</span>
    </div>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  const meta = [
    propertyTypeLabel(listing.property_type),
    `${listing.rooms} room${listing.rooms === 1 ? "" : "s"}`,
    ...(listing.size_sqm ? [`${listing.size_sqm} m²`] : []),
    `${listing.roommates_count} roommate${listing.roommates_count === 1 ? "" : "s"}`,
  ].join(" · ");

  const chips = [
    ...(listing.pets_allowed ? ["Pets OK"] : []),
    ...(listing.smoking_allowed ? ["Smoking OK"] : []),
    ...FEATURES.filter((f) => listing[f.key]).map((f) => f.label),
  ];

  return (
    <article className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm transition-shadow hover:shadow-md">
      {/* Stretched link: the whole card navigates; SaveButton layers above it. */}
      <Link
        href={`/browse/${listing.id}`}
        aria-label={`${listing.title} — ₪${listing.rent.toLocaleString()} per month`}
        className="absolute inset-0 z-[1]"
      />
      <div className="flex min-h-36 sm:min-h-44">
        <div className="relative w-32 shrink-0 self-stretch sm:w-2/5">
          {listing.photo_urls[0] ? (
            <Image
              src={listing.photo_urls[0]}
              alt=""
              fill
              sizes="(min-width: 640px) 40vw, 128px"
              className="object-cover"
            />
          ) : (
            <NoPhoto />
          )}
        </div>
        <div className="min-w-0 flex-1 p-4 pr-14 sm:p-5 sm:pr-16">
          <p className="font-serif text-2xl font-semibold">
            ₪{listing.rent.toLocaleString()}
            <span className="text-sm font-normal text-muted"> / mo</span>
          </p>
          <h3 className="mt-1.5 truncate text-[15px] font-medium">{listing.title}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            {listing.city}
            {listing.neighborhood ? ` · ${listing.neighborhood}` : ""}
          </p>
          <p className="mt-2 text-xs text-muted">{meta}</p>
          {chips.length > 0 ? (
            <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-hairline px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <SaveButton listingId={listing.id} className="absolute right-3 top-3 z-[2]" />
    </article>
  );
}

import Link from "next/link";
import Image from "next/image";
import { FEATURES, propertyTypeLabel } from "@/lib/constants";
import { NoPhoto } from "@/components/listings/NoPhoto";
import { SaveButton } from "@/components/listings/SaveButton";
import type { Listing } from "@/lib/types";

export function ListingCard({
  listing,
  signedIn = false,
  saved = false,
  priority = false,
}: {
  listing: Listing;
  signedIn?: boolean;
  saved?: boolean;
  /**
   * Fetch this cover immediately instead of waiting for the lazy-load
   * threshold. Set by the results list for the handful of cards that are
   * above the fold — see `app/(public)/browse/page.tsx`. Off by default: it is
   * a preload hint, and a page that marks every image priority has marked none.
   */
  priority?: boolean;
}) {
  const meta = [
    propertyTypeLabel(listing.property_type),
    `${listing.rooms} room${listing.rooms === 1 ? "" : "s"}`,
    ...(listing.size_sqm ? [`${listing.size_sqm} m²`] : []),
    `${listing.household_size} roommate${listing.household_size === 1 ? "" : "s"}`,
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
      <div className="flex min-h-36 sm:min-h-44 md:min-h-52">
        <div className="relative w-32 shrink-0 self-stretch sm:w-56 md:w-72 lg:w-80">
          {listing.photo_urls[0] ? (
            <Image
              src={listing.photo_urls[0]}
              alt=""
              fill
              priority={priority}
              sizes="(min-width: 1024px) 320px, (min-width: 768px) 288px, (min-width: 640px) 224px, 128px"
              className="object-cover"
            />
          ) : (
            <NoPhoto className="border-r border-hairline" />
          )}
        </div>
        <div className="flex min-w-0 flex-1">
          {/* pr-14 only reserves room for the heart, which visitors never see. */}
          <div className={`min-w-0 flex-1 p-4 sm:p-5 lg:pr-5 ${signedIn ? "pr-14" : ""}`}>
            <p className="text-2xl font-bold lg:hidden">
              ₪{listing.rent.toLocaleString()}
              <span className="text-sm font-normal text-muted"> / mo</span>
            </p>
            <h3 className="mt-1.5 truncate text-[16px] font-medium lg:mt-0.5 lg:text-base">
              {listing.title}
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted">
              {listing.city}
              {listing.neighborhood ? ` · ${listing.neighborhood}` : ""}
            </p>
            <p className="mt-2 text-xs text-muted">{meta}</p>
            {chips.length > 0 ? (
              <div className="mt-3 hidden flex-wrap gap-1.5 md:flex">
                {chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-hairline px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {/* Wide screens: rent as its own right-aligned scan column. */}
          <div className={`hidden w-44 shrink-0 flex-col items-end border-l border-hairline p-5 lg:flex ${signedIn ? "pr-14" : ""}`}>
            <p className="whitespace-nowrap text-right text-2xl font-bold">
              ₪{listing.rent.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-muted">per month</p>
          </div>
        </div>
      </div>
      <SaveButton
        listingId={listing.id}
        signedIn={signedIn}
        initialSaved={saved}
        className="absolute right-3 top-3 z-[2]"
      />
    </article>
  );
}

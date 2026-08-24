import Link from "next/link";
import type { Listing } from "@/lib/types";

export function ListingCard({ listing }: { listing: Listing }) {
  const specs = [
    `${listing.roommates_count} flatmate${listing.roommates_count === 1 ? "" : "s"}`,
    listing.pets_allowed ? "Pets welcome" : "No pets",
    listing.smoking_allowed ? "Smoking OK" : "No smoking",
  ].join("  ·  ");

  return (
    <Link
      href={`/browse/${listing.id}`}
      className="block overflow-hidden rounded-2xl border border-hairline bg-surface transition-shadow hover:shadow-lg"
    >
      <div className="h-44 bg-hairline">
        {listing.photo_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photo_urls[0]} alt={listing.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold">{listing.title}</h3>
          <p className="whitespace-nowrap font-serif font-semibold">
            ₪{listing.rent.toLocaleString()}<span className="text-xs font-normal text-muted"> /mo</span>
          </p>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {listing.city}{listing.neighborhood ? ` — ${listing.neighborhood}` : ""} · from{" "}
          {new Date(listing.available_from).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
        <p className="mt-2 border-t border-hairline pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {specs}
        </p>
      </div>
    </Link>
  );
}

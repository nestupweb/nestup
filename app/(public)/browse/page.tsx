import Link from "next/link";
import { listingFiltersSchema } from "@/lib/validation/filters";
import { queryListings } from "@/lib/listings";
import { FilterBar } from "@/components/listings/FilterBar";
import { ListingCard } from "@/components/listings/ListingCard";
import { EmptyState } from "@/components/ui/EmptyState";

const FILTER_KEYS = [
  "city", "rent_min", "rent_max", "move_in_by", "roommates_max",
  "pets_allowed", "smoking_allowed", "balcony", "air_conditioning",
  "parking", "elevator", "furnished",
] as const;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const filters = listingFiltersSchema.parse(await searchParams);
  const { listings, total } = await queryListings(filters);
  const filtersActive = FILTER_KEYS.some((k) => filters[k] !== undefined);
  const lastPage = Math.max(1, Math.ceil(total / filters.page_size));

  const pageLink = (page: number) => {
    const params = new URLSearchParams(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    params.set("page", String(page));
    return `/browse?${params.toString()}`;
  };

  return (
    <main className="px-4 pb-16 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Find a room</h1>
      <p className="mt-1 text-sm text-muted">
        Rooms in shared apartments — browse openly, match when you&rsquo;re ready.
      </p>

      <div className="mt-5">
        <FilterBar />
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
        <p className="text-muted">
          {filtersActive
            ? `${total} result${total === 1 ? "" : "s"} match your filters`
            : `${total} room${total === 1 ? "" : "s"} available`}
        </p>
        {filtersActive ? (
          <Link href="/browse" className="shrink-0 text-accent underline underline-offset-4">
            Clear filters
          </Link>
        ) : null}
      </div>

      {listings.length === 0 ? (
        total === 0 && !filtersActive ? (
          <EmptyState
            title="No rooms listed yet"
            hint="Check back soon — or sign up and be the first to list one."
          />
        ) : (
          <>
            <EmptyState
              title="No rooms match your filters"
              hint="Try widening the rent range or clearing a filter."
            />
            <p className="mt-4 text-center">
              <Link href="/browse" className="text-sm text-accent underline underline-offset-4">
                Clear filters
              </Link>
            </p>
          </>
        )
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

      {lastPage > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {filters.page > 1 ? (
            <Link className="text-accent underline" href={pageLink(filters.page - 1)}>← Previous</Link>
          ) : null}
          <span className="text-muted">Page {filters.page} of {lastPage}</span>
          {filters.page < lastPage ? (
            <Link className="text-accent underline" href={pageLink(filters.page + 1)}>Next →</Link>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { getAuthContext } from "@/lib/auth";
import { listingFiltersSchema } from "@/lib/validation/filters";
import { getSavedListingIds, queryListings } from "@/lib/listings";
import { FilterBar } from "@/components/listings/FilterBar";
import { ListingCard } from "@/components/listings/ListingCard";
import { SortMenu } from "@/components/listings/SortMenu";
import { MapExplorer } from "@/components/map/MapExplorer";
import { EmptyState } from "@/components/ui/EmptyState";

const FILTER_KEYS = [
  "city", "rent_min", "rent_max", "move_in_by", "lease_term", "roommates_max",
  "pets_allowed", "smoking_allowed", "balcony", "air_conditioning",
  "parking", "elevator", "furnished",
] as const;

/**
 * The page itself never awaits: the heading, the filter sidebar and the results
 * skeleton are all static, so they ship in the prerendered shell and paint the
 * moment the tab is tapped. Only `<Results>` depends on the URL's filters, and
 * it streams in behind the boundary — or arrives already resolved, because
 * `queryListings` is a shared `use cache` that a prefetch can fill in.
 */
export default function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  return (
    <main className="px-4 pb-16 sm:px-6">
      <h1 className="text-3xl font-bold">Find a room</h1>
      <p className="mt-1 text-sm text-muted">
        Rooms in shared apartments — browse openly, match when you&rsquo;re ready.
      </p>

      <div className="mt-5 lg:mt-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
          <FilterBar />
        </div>
        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

/** Mirrors the results column so the swap in is a fill, not a jump. */
function ResultsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading rooms">
      <div className="mt-4 h-4 w-36 animate-pulse rounded bg-hairline lg:mt-0" />
      <div className="mt-4 flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-36 overflow-hidden rounded-2xl border border-hairline bg-surface sm:min-h-44 md:min-h-52"
          >
            <div className="w-32 shrink-0 animate-pulse bg-hairline sm:w-56 md:w-72 lg:w-80" />
            <div className="flex-1 p-4 sm:p-5">
              <div className="h-7 w-28 animate-pulse rounded bg-hairline lg:h-5 lg:w-3/5" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-hairline" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-hairline" />
              <div className="mt-4 h-3 w-2/3 animate-pulse rounded bg-hairline" />
            </div>
            <div className="hidden w-44 shrink-0 border-l border-hairline p-5 lg:block">
              <div className="ml-auto h-7 w-24 animate-pulse rounded bg-hairline" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const filters = listingFiltersSchema.parse(await searchParams);
  const [{ listings, total }, { user }] = await Promise.all([
    queryListings(filters),
    getAuthContext(),
  ]);
  // Signed-in hearts come from the account (Profile › Liked); visitors use localStorage.
  const savedIds = user ? await getSavedListingIds(user.id) : new Set<string>();
  const filtersActive = FILTER_KEYS.some((k) => filters[k] !== undefined);
  const lastPage = Math.max(1, Math.ceil(total / filters.page_size));

  // Defaults are left out so the URL stays readable: /browse?page=2, not
  // /browse?sort=newest&page_size=20&page=2.
  const DEFAULTS: Record<string, string> = { sort: "newest", page_size: "20" };
  const pageLink = (page: number) => {
    const params = new URLSearchParams(
      Object.entries(filters)
        .filter(([k, v]) => v !== undefined && k !== "page" && String(v) !== DEFAULTS[k])
        .map(([k, v]) => [k, String(v)])
    );
    params.set("page", String(page));
    return `/browse?${params.toString()}`;
  };

  return (
        <div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm lg:mt-0">
            <p className="min-w-0 text-muted">
              {filtersActive
                ? `${total} result${total === 1 ? "" : "s"} match your filters`
                : `${total} room${total === 1 ? "" : "s"} available`}
              {filtersActive ? (
                <>
                  {" · "}
                  <Link href="/browse" className="text-accent underline underline-offset-4">
                    Clear filters
                  </Link>
                </>
              ) : null}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <SortMenu value={filters.sort} />
              <MapExplorer />
            </div>
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
            <div className="mt-4 flex flex-col gap-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} signedIn={Boolean(user)} saved={savedIds.has(l.id)} />
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
        </div>
  );
}

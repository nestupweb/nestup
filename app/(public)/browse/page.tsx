import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { listingFiltersSchema } from "@/lib/validation/filters";
import { queryListingPins, queryListings } from "@/lib/listings";
import { FilterBar } from "@/components/listings/FilterBar";
import { ListingCard } from "@/components/listings/ListingCard";
import { SortMenu } from "@/components/listings/SortMenu";
import { ViewToggle } from "@/components/listings/ViewToggle";
import { ResultsMap } from "@/components/listings/ResultsMap";
import { EmptyState } from "@/components/ui/EmptyState";

const FILTER_KEYS = [
  "city", "rent_min", "rent_max", "move_in_by", "lease_term", "roommates_max",
  "pets_allowed", "smoking_allowed", "balcony", "air_conditioning",
  "parking", "elevator", "furnished",
] as const;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const filters = listingFiltersSchema.parse(await searchParams);
  const mapView = filters.view === "map";
  const [{ listings, total }, pins, { supabase, user }] = await Promise.all([
    queryListings(filters),
    mapView ? queryListingPins(filters) : Promise.resolve([]),
    getAuthContext(),
  ]);
  // Signed-in hearts come from the account (Profile › Liked); visitors use localStorage.
  const savedIds = new Set<string>();
  if (user) {
    const { data } = await supabase.from("saved_listings").select("listing_id").eq("user_id", user.id);
    for (const row of (data as { listing_id: string }[] | null) ?? []) savedIds.add(row.listing_id);
  }
  const filtersActive = FILTER_KEYS.some((k) => filters[k] !== undefined);
  const lastPage = Math.max(1, Math.ceil(total / filters.page_size));

  // Defaults are left out so the URL stays readable: /browse?page=2, not
  // /browse?view=list&sort=newest&page=2.
  const DEFAULTS: Record<string, string> = { view: "list", sort: "newest", page_size: "20" };
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
    <main className="px-4 pb-16 sm:px-6">
      <h1 className="text-3xl font-bold">Find a room</h1>
      <p className="mt-1 text-sm text-muted">
        Rooms in shared apartments — browse openly, match when you&rsquo;re ready.
      </p>

      <div className="mt-5 lg:mt-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
          <FilterBar />
        </div>

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
              {mapView ? null : <SortMenu value={filters.sort} />}
              <ViewToggle value={filters.view} />
            </div>
          </div>

          {mapView && total > 0 ? (
            <ResultsMap pins={pins} unplaced={Math.max(0, total - pins.length)} />
          ) : listings.length === 0 ? (
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

          {!mapView && lastPage > 1 ? (
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
      </div>
    </main>
  );
}

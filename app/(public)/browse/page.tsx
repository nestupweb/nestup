import Link from "next/link";
import { Suspense } from "react";
import { getCachedSession } from "@/lib/auth";
import { listingFiltersSchema } from "@/lib/validation/filters";
import { getListingScoreContext, getSavedListingIds, queryListings } from "@/lib/listings";
import { lifestyleScore, socialScore } from "@/lib/compatibility";
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
        {/* The sidebar scrolls inside itself, so it has to fit the viewport from
            wherever it starts — and it starts below the header and the title
            block (~11rem), not at the top. Sizing it for the sticky offset alone
            hung its footer, and with it "Apply filters", below the fold until
            the page had been scrolled. */}
        <div className="lg:sticky lg:top-6 lg:h-[calc(100dvh-11.5rem)]">
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
  const filtersActive = FILTER_KEYS.some((k) => filters[k] !== undefined);

  // `getCachedSession`, not `getAuthContext`. The latter is an uncached
  // `auth.getUser()` round-trip, and the App Shell prerender stops at the first
  // uncached read — so it kept this whole results list out of the shell and
  // made Listings paint its skeleton on every visit even though `queryListings`
  // was cached and hitting.
  //
  // A second, argument-free copy of this query was tried here, on the theory
  // that keying the cache on URL data was what kept it out of the App Shell.
  // Measured on the live site it changed nothing, so it was removed rather than
  // left in as complexity with no benefit. What the residual delay actually is,
  // measured with the page-slide animation suppressed: ~60ms of client render,
  // stretched to ~300ms of visible skeleton by the view transition. Not a
  // caching problem — this navigation makes no server request at all.
  const [{ listings, total }, session] = await Promise.all([
    queryListings(filters),
    getCachedSession(),
  ]);
  // Signed-in hearts come from the account (Profile › Liked); visitors use localStorage.
  const savedIds = session ? await getSavedListingIds(session.id) : new Set<string>();

  // Match scores, the same two numbers the swipe deck shows. Only the people
  // are fetched here — `queryListings` above stays shared and score-free (see
  // `getListingScoreContext`), and the score itself is computed below from the
  // room the shared cache returned and the profile the private one did.
  //
  // Owner ids are deduplicated and sorted so the cache key is stable: two
  // members whose page happens to hold the same rooms in a different order
  // would otherwise miss a warm entry apiece.
  const ownerIds = session
    ? [...new Set(listings.map((l) => l.owner_id))].sort()
    : [];
  const { seeker, owners } = await getListingScoreContext(ownerIds);

  /**
   * Null wherever a score would be meaningless rather than merely low: nobody
   * signed in, a profile that has not been filled in yet, the member's own
   * room, or an owner whose profile did not come back. Browse is public, so
   * "no score" is the ordinary case here, not an error.
   *
   * Unlike the deck there is no `MIN_DECK_SCORE` gate — Browse is where the
   * lower-scoring rooms are meant to stay reachable, so a weak score is shown
   * as a weak score rather than hiding the room.
   */
  const scoreFor = (l: (typeof listings)[number]) => {
    if (!seeker) return null;
    if (l.owner_id === seeker.user_id) return null;
    const owner = owners[l.owner_id];
    if (!owner) return null;
    return {
      lifestyle: lifestyleScore(seeker, l, owner, "seeker"),
      social: socialScore(seeker, owner),
    };
  };

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
              {/* The first three covers are the ones on screen when the page
                  paints, so they are fetched with the page rather than at the
                  lazy-load threshold — the rest stay lazy. Three, not twenty:
                  preloading a whole page of photos would compete with the ones
                  the member is actually looking at, which is the same rule
                  `SwipeDeck` follows when it warms one card ahead. */}
              {listings.map((l, i) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  signedIn={Boolean(session)}
                  saved={savedIds.has(l.id)}
                  score={scoreFor(l)}
                  priority={i < 3}
                />
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

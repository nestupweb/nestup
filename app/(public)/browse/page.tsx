import Link from "next/link";
import { listingFiltersSchema } from "@/lib/validation/filters";
import { queryListings } from "@/lib/listings";
import { FilterBar } from "@/components/listings/FilterBar";
import { ListingCard } from "@/components/listings/ListingCard";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const filters = listingFiltersSchema.parse(await searchParams);
  const { listings, total } = await queryListings(filters);
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
    <main className="px-5 pb-16">
      <h1 className="font-serif text-3xl font-semibold">Find a room</h1>
      <p className="mb-4 mt-1 text-sm text-muted">{total} available room{total === 1 ? "" : "s"}</p>
      <FilterBar />
      {listings.length === 0 ? (
        <EmptyState title="No rooms match these filters" hint="Try widening the rent range or clearing a filter." />
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
      {lastPage > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {filters.page > 1 ? <Link className="text-accent underline" href={pageLink(filters.page - 1)}>← Previous</Link> : null}
          <span className="text-muted">Page {filters.page} of {lastPage}</span>
          {filters.page < lastPage ? <Link className="text-accent underline" href={pageLink(filters.page + 1)}>Next →</Link> : null}
        </div>
      ) : null}
    </main>
  );
}

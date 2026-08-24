import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FEATURES, propertyTypeLabel } from "@/lib/constants";
import { ListingGallery } from "@/components/listings/ListingGallery";
import { swipeAction } from "@/app/actions/swipe";
import type { Listing, Profile } from "@/lib/types";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  const listing = data as Listing | null;
  if (!listing) notFound();

  // RLS: this returns null for anonymous visitors — by design.
  const { data: ownerData } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", listing.owner_id)
    .maybeSingle();
  const owner = ownerData as Profile | null;

  const features = FEATURES.filter((f) => listing[f.key]).map((f) => f.label);

  return (
    <main className="px-4 pb-16 sm:px-6">
      <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-8 xl:gap-10">
        <div className="lg:col-span-3">
          <ListingGallery photos={listing.photo_urls} title={listing.title} />
        </div>

        <aside className="mt-6 lg:sticky lg:top-6 lg:col-span-2 lg:row-span-2 lg:mt-0">
          <div className="rounded-2xl border border-hairline bg-surface p-5 sm:p-6">
            <h1 className="font-serif text-2xl font-semibold leading-snug lg:text-3xl">
              {listing.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {listing.city}
              {listing.neighborhood ? ` — ${listing.neighborhood}` : ""} · available from{" "}
              {new Date(listing.available_from).toLocaleDateString("en-GB", { dateStyle: "long" })}
            </p>

            <p className="mt-4 font-serif text-3xl font-semibold">
              ₪{listing.rent.toLocaleString()}
              <span className="text-sm font-normal text-muted"> / mo</span>
            </p>

            <p className="mt-4 border-y border-hairline py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {propertyTypeLabel(listing.property_type)} ·{" "}
              {listing.rooms} room{listing.rooms === 1 ? "" : "s"}
              {listing.size_sqm ? ` · ${listing.size_sqm} m²` : ""} ·{" "}
              {listing.roommates_count} flatmate{listing.roommates_count === 1 ? "" : "s"} ·{" "}
              {listing.pets_allowed ? "Pets welcome" : "No pets"} ·{" "}
              {listing.smoking_allowed ? "Smoking OK" : "No smoking"}
            </p>

            {features.length > 0 ? (
              <p className="mt-3 text-sm text-muted">{features.join(" · ")}</p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3">
              {user?.id === listing.owner_id ? null : (
                // Signed-out visitors land on the chat page's login redirect and return here.
                <Link
                  href={`/browse/${listing.id}/chat`}
                  className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-contrast"
                >
                  Message the owner
                </Link>
              )}
              {user ? (
                <form action={swipeAction.bind(null, listing.id, "like")}>
                  <button className="w-full rounded-xl border border-hairline py-3 text-sm font-semibold text-ink hover:border-accent">
                    I&apos;m interested
                  </button>
                </form>
              ) : (
                <Link
                  href={`/login?next=/browse/${listing.id}`}
                  className="block w-full rounded-xl border border-hairline py-3 text-center text-sm font-semibold text-ink hover:border-accent"
                >
                  Sign in to show interest
                </Link>
              )}
            </div>

            <div className="mt-5 border-t border-hairline pt-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                Who lives here
              </h2>
              {owner ? (
                <div className="mt-2 flex items-center gap-3">
                  {owner.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={owner.avatar_url} alt={owner.full_name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-hairline" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{owner.full_name}, {owner.age}</p>
                    <p className="text-xs text-muted">{owner.occupation}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  <Link href={`/login?next=/browse/${listing.id}`} className="text-accent underline">Sign in</Link>{" "}
                  to see who lives here and your compatibility scores.
                </p>
              )}
            </div>
          </div>
        </aside>

        {listing.description ? (
          <div className="lg:col-span-3">
            <p className="mt-6 whitespace-pre-line text-sm leading-relaxed lg:mt-8 lg:text-[15px]">
              {listing.description}
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

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

  const sectionHeading = "font-serif text-xl font-semibold";
  const sectionBody = "mt-3 text-base leading-relaxed";

  return (
    <main className="mx-auto max-w-3xl px-5 pb-20">
      <ListingGallery photos={listing.photo_urls} title={listing.title} />

      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
          {listing.city}, {listing.address || listing.neighborhood}
        </h1>
        <p className="whitespace-nowrap font-serif text-2xl font-semibold sm:text-3xl">
          ₪{listing.rent.toLocaleString()}<span className="text-sm font-normal text-muted"> /mo</span>
        </p>
      </div>
      <p className="mt-2 text-base text-muted">
        Available from {new Date(listing.available_from).toLocaleDateString("en-GB", { dateStyle: "long" })}
      </p>

      <div className="mt-10 space-y-9">
        <section className="border-t border-hairline pt-7">
          <h2 className={sectionHeading}>Property details</h2>
          <p className={sectionBody}>
            {propertyTypeLabel(listing.property_type)} · {listing.rooms} room{listing.rooms === 1 ? "" : "s"}
            {listing.size_sqm ? ` · ${listing.size_sqm} m²` : ""}
          </p>
        </section>

        <section className="border-t border-hairline pt-7">
          <h2 className={sectionHeading}>House rules</h2>
          <p className={sectionBody}>
            {listing.roommates_count} flatmate{listing.roommates_count === 1 ? "" : "s"} ·{" "}
            {listing.pets_allowed ? "Pets welcome" : "No pets"} ·{" "}
            {listing.smoking_allowed ? "Smoking OK" : "No smoking"}
          </p>
        </section>

        {features.length > 0 ? (
          <section className="border-t border-hairline pt-7">
            <h2 className={sectionHeading}>Amenities</h2>
            <p className={sectionBody}>{features.join(" · ")}</p>
          </section>
        ) : null}

        {listing.description ? (
          <section className="border-t border-hairline pt-7">
            <h2 className={sectionHeading}>Description</h2>
            <p className={`${sectionBody} whitespace-pre-line`}>{listing.description}</p>
          </section>
        ) : null}

        <section className="border-t border-hairline pt-7">
          <h2 className={sectionHeading}>Who lives here</h2>
          {owner ? (
            <div className="mt-4 flex items-center gap-4">
              {owner.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={owner.avatar_url} alt={owner.full_name} className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-hairline" />
              )}
              <div>
                <p className="text-base font-medium">{owner.full_name}, {owner.age}</p>
                <p className="mt-0.5 text-sm text-muted">{owner.occupation}</p>
              </div>
            </div>
          ) : (
            <p className={`${sectionBody} text-muted`}>
              <Link href={`/login?next=/browse/${listing.id}`} className="text-accent underline">Sign in</Link>{" "}
              to see who lives here and your compatibility scores.
            </p>
          )}
        </section>
      </div>

      <div className="mt-10 flex flex-col gap-3 border-t border-hairline pt-7">
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
    </main>
  );
}

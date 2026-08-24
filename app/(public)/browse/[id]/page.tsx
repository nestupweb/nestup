import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FEATURES } from "@/lib/constants";
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
    <main className="px-5 pb-16">
      <div className="flex gap-2 overflow-x-auto">
        {listing.photo_urls.length > 0 ? (
          listing.photo_urls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={listing.title} className="h-64 w-auto rounded-2xl object-cover" />
          ))
        ) : (
          <div className="h-64 w-full rounded-2xl bg-hairline" />
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">{listing.title}</h1>
        <p className="whitespace-nowrap font-serif text-2xl font-semibold">
          ₪{listing.rent.toLocaleString()}<span className="text-sm font-normal text-muted"> /mo</span>
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        {listing.city}{listing.neighborhood ? ` — ${listing.neighborhood}` : ""} · available from{" "}
        {new Date(listing.available_from).toLocaleDateString("en-GB", { dateStyle: "long" })}
      </p>

      <p className="mt-4 border-y border-hairline py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {listing.roommates_count} flatmate{listing.roommates_count === 1 ? "" : "s"} ·{" "}
        {listing.pets_allowed ? "Pets welcome" : "No pets"} ·{" "}
        {listing.smoking_allowed ? "Smoking OK" : "No smoking"}
      </p>

      {features.length > 0 ? <p className="mt-3 text-sm text-muted">{features.join(" · ")}</p> : null}
      {listing.description ? <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{listing.description}</p> : null}

      <section className="mt-6 rounded-2xl border border-hairline bg-surface p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">Who lives here</h2>
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
      </section>

      <div className="mt-6">
        {user ? (
          <form action={swipeAction.bind(null, listing.id, "like")}>
            <button className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast">
              I&apos;m interested
            </button>
          </form>
        ) : (
          <Link
            href={`/login?next=/browse/${listing.id}`}
            className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-contrast"
          >
            Sign in to show interest
          </Link>
        )}
      </div>
    </main>
  );
}

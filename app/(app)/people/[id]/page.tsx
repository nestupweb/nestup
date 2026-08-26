import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Avatar } from "@/components/ui/Avatar";
import { PropertyTile } from "@/components/listings/PropertyTile";
import { roomPhoto } from "@/lib/room-photo";
import { AboutView } from "@/components/profile/AboutView";
import type { PublicDetails } from "@/lib/people";
import type { Listing, Profile } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A member's profile as other members see it: the same header and "About me"
 * groups as their own Profile page, read-only, without phone / e-mail.
 * Linked from roommate names on listing pages and the Swipe deck.
 */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await requireUser();
  if (id === user.id) redirect("/profile");

  const [{ data: profileData }, { data: detailRows }, { data: listingRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", id).maybeSingle(),
    supabase.rpc("public_profile_details", { p_user: id }),
    supabase
      .from("listings")
      .select("*")
      .eq("owner_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);
  const profile = profileData as Profile | null;
  if (!profile) notFound();
  const details = ((detailRows as PublicDetails[] | null) ?? [])[0] ?? null;
  const listings = (listingRows as Listing[] | null) ?? [];
  const first = profile.full_name.split(" ")[0] || profile.full_name;

  return (
    <main className="px-4 pb-8 pt-2 sm:px-6">
      <div className="flex items-center gap-4">
        <Avatar url={profile.avatar_url} name={profile.full_name} size={20} className="ring-2 ring-accent ring-offset-2 ring-offset-paper" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">
            {profile.full_name}, {profile.age}
          </h1>
          <p className="truncate text-sm text-muted">{profile.occupation || "NestUp member"}</p>
          {profile.bio ? (
            <p className="mt-1.5 max-w-md whitespace-pre-line text-sm leading-5 text-ink">{profile.bio}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 border-b border-hairline pb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink">About {first}</h2>
      </div>

      <div className="mt-5">
        <AboutView profile={profile} details={details} />
      </div>

      {listings.length > 0 ? (
        <section className="mt-10 border-t border-hairline pt-5">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-accent">
            {first}&rsquo;s {listings.length === 1 ? "listing" : "listings"}
          </h3>
          {/* Same photo tiles as the owner's own "My Listings" tab, but showing the room for rent (the photo tagged "bedroom") rather than the cover. */}
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
            {listings.map((l) => {
              const photo = roomPhoto(l);
              return <PropertyTile key={l.id} listing={l} cover={photo?.url ?? null} badge={photo?.isBedroom ? "The room" : undefined} />;
            })}
          </div>
        </section>
      ) : null}

      <p className="mt-10 text-sm text-muted">
        <Link href="/swipe" className="text-accent underline-offset-2 hover:underline">
          Back to Swipe
        </Link>
      </p>
    </main>
  );
}

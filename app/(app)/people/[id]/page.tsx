import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Avatar } from "@/components/ui/Avatar";
import { ListingPhotoGrid } from "@/components/listings/ListingPhotoGrid";
import { AboutView } from "@/components/profile/AboutView";
import { ContactRow } from "@/components/profile/ContactRow";
import type { PublicDetails } from "@/lib/people";
import type { Listing, Profile } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A member's profile as other members see it: the same header (with their
 * social links) and "About me" sections as their own Profile page, read-only,
 * without phone / e-mail. Linked from roommate names on listing pages and the
 * Swipe deck.
 */
export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `?listing=<id>`: the post the visitor came from (Roommates tab / "Who lives here"). */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { listing: fromParam } = await searchParams;
  const fromListing = typeof fromParam === "string" && UUID.test(fromParam) ? fromParam : null;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await requireUser();
  if (id === user.id) redirect("/profile");

  const [{ data: profileData }, { data: detailRows }, { data: ownedRows }, { data: residentRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", id).maybeSingle(),
    supabase.rpc("public_profile_details", { p_user: id }),
    supabase
      .from("listings")
      .select("*")
      .eq("owner_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    // Rooms this member lives in as a roommate — every member of a household
    // shows the same listing (and the same bedroom photo) on their page.
    supabase.from("listing_residents").select("listing_id").eq("resident_id", id),
  ]);
  const profile = profileData as Profile | null;
  if (!profile) notFound();
  const details = ((detailRows as PublicDetails[] | null) ?? [])[0] ?? null;
  const owned = (ownedRows as Listing[] | null) ?? [];
  const livedIds = ((residentRows as { listing_id: string }[] | null) ?? [])
    .map((r) => r.listing_id)
    .filter((lid) => !owned.some((l) => l.id === lid));
  const { data: livedRows } = livedIds.length
    ? await supabase.from("listings").select("*").in("id", livedIds).eq("is_active", true).order("created_at", { ascending: false })
    : { data: [] as Listing[] };
  // Exactly one room per member, the same for the whole household: the post the
  // visitor came from when it belongs to this member, else the room they live in,
  // else the room they host. Seed users are both hosts and roommates elsewhere.
  const lived = (livedRows as Listing[] | null) ?? [];
  const listing = [...lived, ...owned].find((l) => l.id === fromListing) ?? lived[0] ?? owned[0] ?? null;
  const first = profile.full_name.split(" ")[0] || profile.full_name;

  return (
    <main className="px-4 pb-8 pt-2 sm:px-6">
      {/* General information: portrait, name, occupation, bio — and how to find them online. */}
      <div className="flex items-start gap-4">
        <Avatar url={profile.avatar_url} name={profile.full_name} size={20} className="ring-2 ring-accent ring-offset-2 ring-offset-paper" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">
            {profile.full_name}, {profile.age}
          </h1>
          <p className="truncate text-sm text-muted">{profile.occupation || "NestUp member"}</p>
          {profile.bio ? (
            <p className="mt-1.5 max-w-md whitespace-pre-line text-sm leading-5 text-ink">{profile.bio}</p>
          ) : null}
          <ContactRow instagram={details?.instagram} facebook={details?.facebook} linkedin={details?.linkedin} />
        </div>
      </div>

      <div className="mt-8 border-b border-hairline pb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink">About {first}</h2>
      </div>

      <div className="mt-5">
        <AboutView profile={profile} details={details} />
      </div>

      {listing ? (
        <section className="mt-10 border-t border-hairline pt-5">
          <h3 className="text-[15px] font-bold uppercase tracking-[0.18em] text-accent">{first}&rsquo;s listing</h3>
          {/* The whole post — every photo captioned with its room — identical on every member of the household. */}
          <div className="mt-4">
            <ListingPhotoGrid listing={listing} />
          </div>
        </section>
      ) : null}

    </main>
  );
}

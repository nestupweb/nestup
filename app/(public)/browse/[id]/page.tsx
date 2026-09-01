import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FEATURES, genderLabel, leaseTermLabel, messageHouseholdLabel, propertyTypeLabel, safeRoomLabel } from "@/lib/constants";
import { describeSlots, normalizeSlots } from "@/lib/availability";
import { ListingGallery } from "@/components/listings/ListingGallery";
import { MessageOwner } from "@/components/listings/MessageOwner";
import { SaveButton } from "@/components/listings/SaveButton";
import { DetailIcon, type DetailIconName } from "@/components/listings/DetailIcon";
import { RoomMapButton } from "@/components/map/RoomMapButton";
import { pointOf } from "@/lib/geo";
import { locationNote } from "@/lib/location";
import { queryNearbyListingPins } from "@/lib/listings";
import type { Listing, Profile } from "@/lib/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

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

  const { data } = await supabase.from("listings").select("*").eq("id", id).is("removed_at", null).maybeSingle();
  const listing = data as Listing | null;
  if (!listing) notFound();

  // Signed-in extras: heart state, "recently viewed" for Profile › History, and
  // what the "Message the roommate(s)" button needs to open its sheet with no
  // round-trip — the seeker's own default hello, and whether they have a
  // profile at all (without one they still go through the chat route, which
  // sends them to onboarding).
  let saved = false;
  let introTemplate = "";
  let hasProfile = false;
  if (user) {
    const [{ data: savedRow }, , { data: detailsRow }, { data: meRow }] = await Promise.all([
      supabase.from("saved_listings").select("listing_id").eq("user_id", user.id).eq("listing_id", listing.id).maybeSingle(),
      supabase
        .from("listing_views")
        .upsert(
          { user_id: user.id, listing_id: listing.id, viewed_at: new Date().toISOString() },
          { onConflict: "user_id,listing_id" }
        ),
      supabase.from("profile_details").select("intro_template").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    saved = Boolean(savedRow);
    introTemplate = (detailsRow as { intro_template: string } | null)?.intro_template ?? "";
    hasProfile = Boolean(meRow);
  }

  // RLS: this returns null for anonymous visitors — by design.
  const { data: ownerData } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", listing.owner_id)
    .maybeSingle();
  const owner = ownerData as Profile | null;

  // Extra roommates beyond the owner (RLS: signed-in only, like profiles).
  const { data: residentRows } = await supabase
    .from("listing_residents")
    .select("profiles(*)")
    .eq("listing_id", listing.id);
  const residents = (residentRows ?? [])
    .map((r) => r.profiles as unknown as Profile | null)
    .filter((p): p is Profile => p !== null && p.user_id !== listing.owner_id);

  // The household and anyone already chatting about the room see the real
  // point; everyone else gets the neighbourhood circle (see lib/location.ts).
  // Only a room we can place exactly gets a map. One whose address never
  // resolved still has a city-centre point in the column from the old
  // pipeline; showing it would be claiming a precision we don't have.
  const place = listing.coords_source === "city" ? null : pointOf(listing);

  // The alternatives the map draws in red. Only fetched for a room we can put
  // on a map at all, and only ever the rooms around it (user request,
  // 2026-08-28: compare this one against what else is going, on one map).
  const nearby = place ? await queryNearbyListingPins(place, listing.id) : [];

  const features = FEATURES.filter((f) => listing[f.key]);
  const viewingHours = describeSlots(normalizeSlots(listing.viewing_slots));

  const AMENITY_ICONS: Record<string, DetailIconName> = {
    balcony: "balcony",
    air_conditioning: "snowflake",
    parking: "parking",
    elevator: "elevator",
    furnished: "sofa",
  };
  const propertyIcon: DetailIconName =
    listing.property_type === "private_house" || listing.property_type === "garden_apartment"
      ? "home"
      : "building";

  const sectionHeading = "text-xl font-semibold";
  const sectionBody = "mt-3 text-base leading-relaxed";
  const itemRow = "mt-4 flex flex-wrap gap-x-7 gap-y-3 text-base";
  const item = "inline-flex items-center gap-2.5";

  return (
    <main className="mx-auto max-w-3xl px-5 pb-20">
      <ListingGallery photos={listing.photo_urls} labels={listing.photo_labels ?? []} title={listing.title} />

      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">
          {listing.city}, {listing.address || listing.neighborhood}
        </h1>
        <div className="flex shrink-0 items-center gap-3">
          <p className="whitespace-nowrap text-2xl font-bold sm:text-3xl">
            ₪{listing.rent.toLocaleString()}<span className="text-sm font-normal text-muted"> /mo</span>
          </p>
          <SaveButton listingId={listing.id} signedIn={Boolean(user)} initialSaved={saved} />
        </div>
      </div>
      {/* Entrance date and a rough duration — never an end date (user decision). */}
      <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2 text-base">
        <div className="flex items-baseline gap-2">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Entrance date</dt>
          <dd className="font-semibold text-ink">
            {new Date(listing.available_from).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">For how long</dt>
          <dd className="font-semibold text-ink">{leaseTermLabel(listing.lease_term ?? "flexible")}</dd>
        </div>
      </dl>

      <div className="mt-10 space-y-9">
        <section className="border-t border-hairline pt-7">
          <h2 className={sectionHeading}>Property details</h2>
          <div className={itemRow}>
            <span className={item}>
              <DetailIcon name={propertyIcon} />
              {propertyTypeLabel(listing.property_type)}
            </span>
            <span className={item}>
              <DetailIcon name="door" />
              {listing.rooms} room{listing.rooms === 1 ? "" : "s"}
            </span>
            {listing.size_sqm ? (
              <span className={item}>
                <DetailIcon name="ruler" />
                {listing.size_sqm} m²
              </span>
            ) : null}
            {listing.safe_room && listing.safe_room !== "none" ? (
              <span className={item}>
                <DetailIcon name="shield" />
                Mamad {safeRoomLabel(listing.safe_room).toLowerCase()}
              </span>
            ) : null}
          </div>
        </section>

        {place ? (
          <section className="border-t border-hairline pt-7">
            <h2 className={sectionHeading}>Where it is</h2>
            <div className="mt-4">
              <RoomMapButton
                point={place}
                address={listing.address || [listing.street, listing.house_number].filter(Boolean).join(" ")}
                city={listing.city}
                note={locationNote(listing)}
                nearby={nearby}
              />
            </div>
          </section>
        ) : null}

        <section className="border-t border-hairline pt-7">
          <h2 className={sectionHeading}>House rules</h2>
          <div className={itemRow}>
            <span className={item}>
              <DetailIcon name="users" />
              {listing.roommates_count} roommate{listing.roommates_count === 1 ? "" : "s"}
            </span>
            <span className={item}>
              <DetailIcon name="paw" />
              {listing.pets_allowed ? "Pets welcome" : "No pets"}
            </span>
            <span className={item}>
              <DetailIcon name={listing.smoking_allowed ? "smoking" : "no-smoking"} />
              {listing.smoking_allowed ? "Smoking OK" : "No smoking"}
            </span>
            {listing.wanted_gender ? (
              <span className={item}>
                <DetailIcon name="users" />
                {genderLabel(listing.wanted_gender)} roommates only
              </span>
            ) : null}
            {listing.food_restrictions ? (
              <span className={item}>
                <DetailIcon name="food" />
                {listing.food_restrictions}
              </span>
            ) : null}
          </div>
        </section>

        {/* Order (user request): Property details → House rules → Amenities, then viewing hours. */}
        {features.length > 0 ? (
          <section className="border-t border-hairline pt-7">
            <h2 className={sectionHeading}>Amenities</h2>
            <div className={itemRow}>
              {features.map((f) => (
                <span key={f.key} className={item}>
                  <DetailIcon name={AMENITY_ICONS[f.key] ?? "building"} />
                  {f.label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {viewingHours.length > 0 ? (
          <section className="border-t border-hairline pt-7">
            <h2 className={sectionHeading}>Viewing hours</h2>
            <div className={itemRow}>
              {viewingHours.map((h) => (
                <span key={h} className={item}>
                  <DetailIcon name="calendar" />
                  {h}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">Request a time in the chat — the host approves it before it goes on the calendar.</p>
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
            <div className="mt-4 space-y-5">
              {[owner, ...residents].map((p) => (
                <Link
                  key={p.user_id}
                  href={`/people/${p.user_id}?listing=${listing.id}`}
                  className="group flex items-center gap-4"
                  aria-label={`${p.full_name}'s profile`}
                >
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatar_url}
                      alt=""
                      // The household sits well below the fold, behind the
                      // gallery and the whole description; there is no reason for
                      // these to compete with the photos at the top of the page.
                      loading="lazy"
                      decoding="async"
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-hairline" />
                  )}
                  <div>
                    <p className="text-base font-medium underline-offset-4 group-hover:text-accent group-hover:underline">
                      {p.full_name}, {p.age}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{p.occupation}</p>
                  </div>
                </Link>
              ))}
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
        {user?.id === listing.owner_id ? null : user && hasProfile && owner ? (
          // The message is written first, in a sheet over this page; the thread
          // is created only if it is actually sent.
          <MessageOwner listingId={listing.id} household={[owner, ...residents]} template={introTemplate} />
        ) : (
          // Signed-out visitors — and anyone who hasn't made a profile yet —
          // land on the chat route's login / onboarding redirect and return here.
          // RLS hides the household from them, so the label falls back to the
          // advertised count; they can't see "Who lives here" to contradict it,
          // and signing in re-renders the button off the real household.
          <Link
            href={`/browse/${listing.id}/chat`}
            className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-contrast"
          >
            {messageHouseholdLabel(listing.roommates_count)}
          </Link>
        )}
      </div>
    </main>
  );
}

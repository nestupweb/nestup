import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Avatar } from "@/components/ui/Avatar";
import { ListingCard } from "@/components/listings/ListingCard";
import { profileGroups, type PublicDetails } from "@/lib/people";
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
  const groups = profileGroups(profile, details);
  const about = details?.about?.trim() ?? "";
  const first = profile.full_name.split(" ")[0] || profile.full_name;

  return (
    <main className="px-4 pb-8 pt-2 sm:px-6">
      <div className="flex items-center gap-4">
        <Avatar url={profile.avatar_url} name={profile.full_name} size={20} className="ring-2 ring-accent ring-offset-2 ring-offset-paper" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">
            {profile.full_name}, {profile.age}
          </h1>
          <p className="truncate text-sm text-muted">{profile.occupation || "NestUp member"}</p>
          {profile.bio ? (
            <p className="mt-1.5 max-w-md whitespace-pre-line text-sm leading-5 text-ink">{profile.bio}</p>
          ) : null}
        </div>
      </div>

      {profile.interests.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {profile.interests.map((s) => (
            <span
              key={s}
              className="rounded-full border border-hairline px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-8 border-b border-hairline pb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink">About {first}</h2>
      </div>

      {about ? (
        <p className="mt-5 max-w-2xl whitespace-pre-line text-[16px] leading-6">{about}</p>
      ) : (
        <p className="mt-5 text-sm text-muted">{first} hasn&rsquo;t written an introduction yet.</p>
      )}

      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <section key={g.title} className="border-t border-hairline pt-5">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">{g.title}</h3>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {g.rows.map((r) => (
                <div key={r.label} className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{r.label}</dt>
                  <dd className="mt-0.5 break-words text-sm text-ink">
                    {r.href ? (
                      <a href={r.href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                        {r.value}
                      </a>
                    ) : (
                      r.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {listings.length > 0 ? (
        <section className="mt-10 border-t border-hairline pt-5">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">
            {first}&rsquo;s {listings.length === 1 ? "room" : "rooms"}
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} signedIn />
            ))}
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

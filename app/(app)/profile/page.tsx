import Link from "next/link";
import { getAuthContext, getOwnProfile } from "@/lib/auth";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileTabs, type ProfileTabItem } from "@/components/profile/ProfileTabs";
import { PROFILE_EDIT_ON_PENCIL_PAGE } from "@/lib/feature-flags";
import type { Listing, ProfileDetails } from "@/lib/types";

type JoinedRow<K extends string> = { [P in K]: string } & { listings: Listing | null };

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string; next?: string; tab?: string; published?: string }>;
}) {
  const { profile, userId } = await getOwnProfile();
  const { onboarding, next, tab, published } = await searchParams;

  // First-run (or explicit onboarding link): the form is the whole page.
  if (!profile || onboarding === "1") {
    return (
      <ProfileForm
        profile={profile}
        onboarding
        next={typeof next === "string" ? next : ""}
      />
    );
  }

  const { supabase, user } = await getAuthContext();
  const [mineRes, likedRes, historyRes, detailsRes] = await Promise.all([
    supabase.from("listings").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase
      .from("saved_listings")
      .select("created_at, listings(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("listing_views")
      .select("viewed_at, listings(*)")
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false })
      .limit(30),
    supabase.from("profile_details").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const details = (detailsRes.data as ProfileDetails | null) ?? null;

  const mine: ProfileTabItem[] = ((mineRes.data as Listing[] | null) ?? []).map((listing) => ({ listing }));
  const liked: ProfileTabItem[] = ((likedRes.data as unknown as JoinedRow<"created_at">[] | null) ?? [])
    .filter((r) => r.listings)
    .map((r) => ({ listing: r.listings as Listing, caption: `Liked ${shortDate(r.created_at)}` }));
  const history: ProfileTabItem[] = ((historyRes.data as unknown as JoinedRow<"viewed_at">[] | null) ?? [])
    .filter((r) => r.listings)
    .map((r) => ({ listing: r.listings as Listing, caption: `Viewed ${shortDate(r.viewed_at)}` }));

  const initial = tab === "liked" || tab === "history" || tab === "listings" ? tab : "about";

  return (
    <main className="px-4 pb-8 pt-2 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-4xl font-bold">Profile</h1>
        <Link
          href="/listing"
          aria-label="List a room"
          title="List a room"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-2xl font-light leading-none text-ink transition-colors hover:border-accent hover:text-accent"
        >
          +
        </Link>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <ProfileAvatar url={profile.avatar_url} name={profile.full_name} />
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">
            {profile.full_name}, {profile.age}
          </p>
          <p className="truncate text-sm text-muted">{profile.occupation || "NestUp member"}</p>
          {profile.bio ? (
            <p className="mt-1.5 max-w-md whitespace-pre-line text-sm leading-5 text-ink">{profile.bio}</p>
          ) : null}
        </div>
      </div>

      {published === "1" ? (
        <p role="status" className="mt-6 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          Your room is live — it&rsquo;s on Listings now, and seekers see it in Swipe when it&rsquo;s a good match.
        </p>
      ) : null}

      <div className="mt-8">
        <ProfileTabs
          mine={mine}
          liked={liked}
          history={history}
          initial={initial}
          about={{ profile, details, email: user?.email ?? "", readOnly: PROFILE_EDIT_ON_PENCIL_PAGE }}
        />
      </div>
    </main>
  );
}

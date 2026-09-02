import Link from "next/link";
import { Suspense } from "react";
import { getAuthContext, getOwnProfile } from "@/lib/auth";
import { ContactRow } from "@/components/profile/ContactRow";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { DAILY_LIFE_GAPS_NOTICE } from "@/lib/constants";
import { PROFILE_EDIT_ON_PENCIL_PAGE } from "@/lib/feature-flags";
import { getProfileTabData } from "@/lib/profile-data";

type ProfileSearch = Promise<{ onboarding?: string; next?: string; tab?: string; published?: string; saved?: string }>;

/**
 * The heading and the Edit Profile button are the same for everyone, so they
 * ship in the static shell and paint on the tap. Everything below depends on
 * the session — the member's own name, photo and tabs — and streams in behind
 * the skeleton. Before this, the page awaited `getOwnProfile()` (three
 * uncached round-trips: getUser, suspensions, profiles) before emitting a
 * single byte, which is why Profile stayed the slowest tab even once its data
 * was cached.
 */
export default function ProfilePage({ searchParams }: { searchParams: ProfileSearch }) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileBody searchParams={searchParams} />
    </Suspense>
  );
}

const pulse = "animate-pulse rounded bg-hairline";

/** Mirrors the real page's shape so the swap is a fill, not a jump. */
function ProfileSkeleton() {
  return (
    <main className="px-4 pb-8 pt-2 sm:px-6" aria-busy="true" aria-label="Loading profile">
      <div className="flex items-start justify-between gap-4">
        <div className={`h-10 w-36 ${pulse}`} />
        <div className="h-10 w-32 animate-pulse rounded-full border border-hairline" />
      </div>
      <div className="mt-5 flex items-center gap-4">
        <div className="h-28 w-28 shrink-0 animate-pulse rounded-full bg-hairline" />
        <div className="min-w-0 flex-1">
          <div className={`h-6 w-44 ${pulse}`} />
          <div className={`mt-2 h-4 w-28 ${pulse}`} />
          <div className={`mt-3 h-4 w-3/4 ${pulse}`} />
        </div>
      </div>
      <div className="mt-8 flex gap-6 border-b border-hairline pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-3 w-16 ${pulse}`} />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full border border-hairline" />
        ))}
      </div>
    </main>
  );
}

async function ProfileBody({ searchParams }: { searchParams: ProfileSearch }) {
  const { profile, userId } = await getOwnProfile();
  const { onboarding, next, tab, published, saved } = await searchParams;

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

  const { user } = await getAuthContext();
  // One cached, tagged read for the whole tab set — see `lib/profile-data.ts`.
  const { mine, liked, history, details, invites, shared } = await getProfileTabData(userId);

  const initial = tab === "liked" || tab === "history" || tab === "listings" ? tab : "about";

  return (
    <main className="px-4 pb-8 pt-2 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-4xl font-bold">Profile</h1>
        <Link
          href="/profile/edit"
          className="shrink-0 rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Edit Profile
        </Link>
      </div>

      {/* General information: portrait, name, occupation, bio — and my contact details (phone / e-mail are mine to see only). */}
      <div className="mt-5 flex items-start gap-4">
        <ProfileAvatar url={profile.avatar_url} name={profile.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold">
            {profile.full_name}, {profile.age}
          </p>
          <p className="truncate text-sm text-muted">{profile.occupation || "NestUp member"}</p>
          {profile.bio ? (
            <p className="mt-1.5 max-w-md whitespace-pre-line text-sm leading-5 text-ink">{profile.bio}</p>
          ) : null}
          <ContactRow
            instagram={details?.instagram}
            facebook={details?.facebook}
            linkedin={details?.linkedin}
            phone={details?.phone}
            email={details?.contact_email || user?.email || ""}
          />
        </div>
      </div>

      {/* Sent here by Save on the edit form when Daily life is still short of
          answers — the save worked, this is what it left behind. */}
      {saved === "daily-life" ? (
        <p role="status" className="mt-6 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          {DAILY_LIFE_GAPS_NOTICE}
        </p>
      ) : null}

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
          invites={invites}
          shared={shared}
        />
      </div>
    </main>
  );
}

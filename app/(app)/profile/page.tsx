import Link from "next/link";
import { getAuthContext, getOwnProfile } from "@/lib/auth";
import { ContactRow } from "@/components/profile/ContactRow";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { PROFILE_EDIT_ON_PENCIL_PAGE } from "@/lib/feature-flags";
import { getProfileTabData } from "@/lib/profile-data";

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

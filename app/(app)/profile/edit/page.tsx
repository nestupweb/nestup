import { getAuthContext, getOwnProfile } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PROFILE_EDIT_ON_PENCIL_PAGE } from "@/lib/feature-flags";
import type { ProfileDetails } from "@/lib/types";

export default async function ProfileEditPage({
  searchParams,
}: {
  searchParams: Promise<{ needs?: string }>;
}) {
  const { profile, userId } = await getOwnProfile();
  // Sent here by /swipe: say why, rather than bouncing them with no reason.
  const { needs } = await searchParams;

  // With the flag on, the pencil page is the one place to edit everything —
  // including the About-me details (owner-only rows, RLS).
  let about: { details: ProfileDetails | null; email: string } | undefined;
  if (PROFILE_EDIT_ON_PENCIL_PAGE && profile) {
    const { supabase, user } = await getAuthContext();
    const { data } = await supabase.from("profile_details").select("*").eq("user_id", userId).maybeSingle();
    about = { details: (data as ProfileDetails | null) ?? null, email: user?.email ?? "" };
  }

  // The "← Back to profile" link under the site header comes from the layout's BackButton.
  return (
    <ProfileForm
      profile={profile}
      onboarding={!profile}
      next="/profile"
      about={about}
      needsDailyLife={needs === "daily-life"}
    />
  );
}

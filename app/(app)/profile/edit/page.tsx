import Link from "next/link";
import { getAuthContext, getOwnProfile } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PROFILE_EDIT_ON_PENCIL_PAGE } from "@/lib/feature-flags";
import type { ProfileDetails } from "@/lib/types";

export default async function ProfileEditPage() {
  const { profile, userId } = await getOwnProfile();

  // With the flag on, the pencil page is the one place to edit everything —
  // including the About-me details (owner-only rows, RLS).
  let about: { details: ProfileDetails | null; email: string } | undefined;
  if (PROFILE_EDIT_ON_PENCIL_PAGE && profile) {
    const { supabase, user } = await getAuthContext();
    const { data } = await supabase.from("profile_details").select("*").eq("user_id", userId).maybeSingle();
    about = { details: (data as ProfileDetails | null) ?? null, email: user?.email ?? "" };
  }

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2 sm:px-6">
        <Link href="/profile" className="text-sm text-muted hover:text-ink">← Back to profile</Link>
      </div>
      <ProfileForm profile={profile} onboarding={!profile} next="/profile" about={about} />
    </>
  );
}

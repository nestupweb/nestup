import Link from "next/link";
import { getOwnProfile } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function ProfileEditPage() {
  const { profile } = await getOwnProfile();
  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2 sm:px-6">
        <Link href="/profile" className="text-sm text-muted hover:text-ink">← Back to profile</Link>
      </div>
      <ProfileForm profile={profile} onboarding={!profile} next="/profile" />
    </>
  );
}

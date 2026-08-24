import { getOwnProfile } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { profile } = await getOwnProfile();
  const { onboarding } = await searchParams;
  return <ProfileForm profile={profile} onboarding={onboarding === "1"} />;
}

import { getAuthContext, requireProfile } from "@/lib/auth";
import { AccountSection } from "@/components/settings/AccountSection";
import { PrivacySection } from "@/components/settings/PrivacySection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { DangerZone } from "@/components/settings/DangerZone";
import { BlockedSection } from "@/components/settings/BlockedSection";
import { getBlockedProfiles } from "@/lib/moderation";
import { queryListingHeirs } from "@/lib/handover";
import type { Listing, ProfileDetails } from "@/lib/types";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/**
 * Everything technical about the account, reached from the gear in the header:
 * the address you sign in with, what other members may see, the one e-mail we
 * send, and the way out. Nothing here is part of your public profile.
 */
export default async function SettingsPage() {
  const { profile, userId } = await requireProfile("/settings");
  const { supabase, user } = await getAuthContext();

  const [detailsRes, listingRes, blocked] = await Promise.all([
    supabase.from("profile_details").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("listings")
      .select("*")
      .eq("owner_id", userId)
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getBlockedProfiles(supabase, userId),
  ]);
  // Who could take the listing on if this member closes their account, so the
  // warning in Danger zone is right on the first paint rather than after a
  // round trip (migration 0040).
  const heirs = await queryListingHeirs();
  // Owner-only read: the privacy flags decide what OTHER members get from
  // `public_profile_details()`, never what the owner sees of their own row.
  const details = (detailsRes.data as ProfileDetails | null) ?? null;
  const listing = (listingRes.data as Listing | null) ?? null;
  const authEmail = user?.email ?? "";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-2 sm:px-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Your account, what other members can see, and what we e-mail you about.
      </p>

      <AccountSection email={authEmail} />

      <PrivacySection
        showPhone={details?.show_phone ?? true}
        showEmail={details?.show_contact_email ?? true}
        hasPhone={Boolean(details?.phone?.trim())}
        hasEmail={Boolean(details?.contact_email?.trim())}
        listing={listing ? { id: listing.id, title: listing.title, isActive: listing.is_active } : null}
      />

      <NotificationsSection
        notify={profile.notify_new_matches}
        address={details?.contact_email?.trim() || authEmail}
      />

      <BlockedSection blocked={blocked} />

      <DangerZone email={authEmail} heirs={heirs} />
    </main>
  );
}

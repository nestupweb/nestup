"use client";

import { Card } from "@/components/settings/Card";
import { SettingToggle } from "@/components/settings/SettingToggle";
import { setListingActiveAction, setPrivacyAction } from "@/app/actions/settings";

/**
 * What other members can see. The two contact switches are enforced inside
 * `public_profile_details()` (migration 0023), so a hidden number is null for
 * anyone querying directly — not merely absent from the page.
 */
export function PrivacySection({
  showPhone,
  showEmail,
  hasPhone,
  hasEmail,
  listing,
}: {
  showPhone: boolean;
  showEmail: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  listing: { id: string; title: string; isActive: boolean } | null;
}) {
  return (
    <Card title="Privacy" hint="What other signed-in members can see on your profile.">
      <SettingToggle
        label="Show my phone number"
        hint={hasPhone ? "Members can tap it to call you." : "You haven't added a phone number yet."}
        checked={showPhone}
        onSave={(v) => setPrivacyAction("show_phone", v)}
      />
      <SettingToggle
        label="Show my e-mail address"
        hint={hasEmail ? "Members can tap it to write to you." : "You haven't added a contact e-mail yet."}
        checked={showEmail}
        onSave={(v) => setPrivacyAction("show_contact_email", v)}
      />
      {listing ? (
        <SettingToggle
          label="My listing is live"
          hint={`Turn this off to take “${listing.title}” out of Listings and Swipe without deleting it.`}
          checked={listing.isActive}
          onSave={(v) => setListingActiveAction(listing.id, v)}
        />
      ) : null}
    </Card>
  );
}

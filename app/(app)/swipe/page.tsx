import Link from "next/link";
import { getOwnProfile } from "@/lib/auth";
import { isApartmentPrefsComplete, listLabels, missingApartmentPrefs } from "@/lib/apartment-prefs";
import { getCachedDeck } from "@/lib/swipe-deck";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";

/** Where unfinished Apartment preferences send a member, and why. */
export const FINISH_APARTMENT_PREFS = "/profile/edit?needs=apartment-prefs";

/**
 * Signing in always lands here — this is the one page, not a redirect chain
 * through Edit Profile. Whatever's missing (no profile row yet, or Apartment
 * preferences with nothing in them) is said on this page instead (2026-08-30):
 * a member used to be bounced to Edit Profile on every login, which reads as
 * "swipe is broken" rather than "one thing left to do."
 */
export default async function SwipePage() {
  const { profile } = await getOwnProfile();

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
        <SwipeGate
          heading="Finish your profile to start swiping."
          body="Rooms are matched against your profile, and yours isn’t set up yet."
          ctaHref="/profile/edit"
          ctaLabel="Complete profile"
        />
      </main>
    );
  }

  // Budget, cities and move-in date are what a room is ranked against; without
  // them every listing scores the same and the deck is a guess. Saving a
  // profile without them is fine — being recommended rooms is not.
  if (!isApartmentPrefsComplete(profile)) {
    const missing = missingApartmentPrefs(profile);
    return (
      <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
        <SwipeGate
          heading="No suggested listings yet."
          body={`Rooms here are ranked against your apartment preferences, and ${listLabels(missing)} ${
            missing.length > 1 ? "are" : "is"
          } still empty. Fill ${missing.length > 1 ? "them" : "it"} in and the deck opens — amenities stay optional.`}
          ctaHref={FINISH_APARTMENT_PREFS}
          ctaLabel="Finish preferences"
        />
      </main>
    );
  }

  // Cached and tagged per member — see `getCachedDeck`.
  const deck = await getCachedDeck(profile.user_id);
  if (!deck) {
    return (
      <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
        <SwipeGate
          heading="Finish your profile to start swiping."
          body="Rooms are matched against your profile, and yours isn’t set up yet."
          ctaHref="/profile/edit"
          ctaLabel="Complete profile"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
      <SwipeDeck
        entries={deck.entries}
        seeker={profile}
        introTemplate={deck.introTemplate}
        interest={deck.interest}
        events={deck.events}
      />
    </main>
  );
}

/** What Swipe shows instead of a deck when something needed is missing. */
function SwipeGate({
  heading,
  body,
  ctaHref,
  ctaLabel,
}: {
  heading: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="mx-auto mt-24 max-w-sm px-6 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">Swipe</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight">{heading}</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
      <div className="mt-7 flex justify-center gap-3">
        <Link href={ctaHref} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast">
          {ctaLabel}
        </Link>
        <Link
          href="/browse"
          className="rounded-full border border-hairline px-5 py-2 text-sm font-semibold text-ink hover:border-accent"
        >
          Browse all
        </Link>
      </div>
    </div>
  );
}

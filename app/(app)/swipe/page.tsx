import Link from "next/link";
import { getOwnProfile } from "@/lib/auth";
import { FINISH_APARTMENT_PREFS, NEEDS_CITY, hasPreferredCity } from "@/lib/apartment-prefs";
import { getCachedDeck } from "@/lib/swipe-deck";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";
import { DailyLifeReminder } from "@/components/profile/DailyLifeReminder";
import { NoCityPrompt } from "@/components/profile/NoCityPrompt";

/**
 * Signing in always lands here — this is the one page, not a redirect chain
 * through Edit Profile. Whatever's missing (no profile row yet, or Apartment
 * preferences with nothing in them) is said on this page instead (2026-08-30):
 * a member used to be bounced to Edit Profile on every login, which reads as
 * "swipe is broken" rather than "one thing left to do."
 */
export default async function SwipePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; needs?: string }>;
}) {
  const [{ profile }, { saved, needs }] = await Promise.all([getOwnProfile(), searchParams]);
  // A profile save that left something unfinished sends the member here with a
  // flag, and the flag rides above whatever the page shows — including the gates
  // below, which a save can perfectly well land on.
  //
  // At most one modal, and the blocking one wins: no preferred city means no
  // matches at all, so it is what a member needs to read first. The Daily-life
  // nudge is only about sharpness, and it keeps until next time. `hasPreferredCity`
  // is re-checked here rather than trusted from the URL, so a stale `?needs=cities`
  // — a shared link, a back button after fixing it — shows nothing.
  const reminder =
    needs === NEEDS_CITY && !hasPreferredCity(profile) ? (
      <NoCityPrompt />
    ) : saved === "daily-life" ? (
      <DailyLifeReminder />
    ) : null;

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
        <SwipeGate
          heading="Finish your profile to start swiping."
          body="Rooms are matched against your profile, and yours isn’t set up yet."
          ctaHref="/profile/edit"
          ctaLabel="Complete profile"
        />
        {reminder}
      </main>
    );
  }

  // The one requirement (user, 2026-09-02): at least one preferred city. The
  // deck is filtered by city before anything is scored, so a member who has
  // named none is asking to be ranked against the whole country by nothing they
  // said about where they want to live. Saving a profile without a city is fine
  // — being recommended rooms is not. Budget, move-in and amenities are all
  // deliberately optional here (see `lib/apartment-prefs.ts`).
  if (!hasPreferredCity(profile)) {
    return (
      <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
        <SwipeGate
          heading="No suggested listings yet."
          body="Matches are found by location, and you haven’t named a city yet. Add at least one preferred city and the deck opens — budget, move-in and amenities all stay optional."
          ctaHref={FINISH_APARTMENT_PREFS}
          ctaLabel="Add a city"
        />
        {reminder}
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
        {reminder}
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
      {reminder}
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

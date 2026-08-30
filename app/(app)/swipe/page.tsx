import Link from "next/link";
import { getOwnProfile } from "@/lib/auth";
import { isDailyLifeComplete } from "@/lib/daily-life";
import { getCachedDeck } from "@/lib/swipe-deck";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";

/** Where an unfinished Daily life table sends a member, and why. */
export const FINISH_DAILY_LIFE = "/profile/edit?needs=daily-life";

/**
 * Signing in always lands here — this is the one page, not a redirect chain
 * through Edit Profile. Whatever's missing (no profile row yet, or an
 * unfinished Daily life table) is said on this page instead (2026-08-30): a
 * member used to be bounced to Edit Profile on every login until they
 * finished the questionnaire, which reads as "swipe is broken" rather than
 * "one thing left to do."
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

  // Scores come from the Daily life questionnaire, so a deck built without it
  // is ordered by nothing the member said. Saving a half-filled table is
  // fine; swiping on one is not.
  if (!isDailyLifeComplete(profile)) {
    return (
      <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
        <SwipeGate
          heading="No suggested listings yet."
          body="Every room here is ranked against your Daily life answers, and those aren’t filled in yet — so there’s nothing to suggest until they are."
          ctaHref={FINISH_DAILY_LIFE}
          ctaLabel="Finish Daily life"
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

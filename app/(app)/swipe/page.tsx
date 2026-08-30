import Link from "next/link";
import { getAuthContext, requireProfile } from "@/lib/auth";
import { isDailyLifeComplete } from "@/lib/daily-life";
import { getPersonalisedDeck } from "@/lib/swipe";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";

/** Where an unfinished Daily life table sends a member, and why. */
export const FINISH_DAILY_LIFE = "/profile/edit?needs=daily-life";

export default async function SwipePage() {
  // Scores come from the questionnaire, so the deck needs a finished profile.
  const { profile } = await requireProfile("/swipe");
  // …and a finished Daily life table. Every room here is ranked by those
  // answers, so a deck built without them is ordered by nothing the member
  // said. Rather than force the member off swipe to fill it in (2026-08-30:
  // that sent someone back to Edit Profile on every login, not just the
  // first), the page opens as normal and explains why there's nothing to show.
  if (!isDailyLifeComplete(profile)) {
    return (
      <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
        <NoDailyLife />
      </main>
    );
  }
  const { supabase } = await getAuthContext();
  const [deck, { data: details }] = await Promise.all([
    getPersonalisedDeck(supabase, profile),
    supabase.from("profile_details").select("intro_template").eq("user_id", profile.user_id).maybeSingle(),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
      <SwipeDeck
        entries={deck.entries}
        seeker={profile}
        introTemplate={details?.intro_template ?? ""}
        interest={deck.interest}
        events={deck.events}
      />
    </main>
  );
}

function NoDailyLife() {
  return (
    <div className="mx-auto mt-24 max-w-sm px-6 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">Swipe</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight">No suggested listings yet.</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Every room here is ranked against your Daily life answers, and those
        aren&rsquo;t filled in yet — so there&rsquo;s nothing to suggest until they are.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link
          href={FINISH_DAILY_LIFE}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast"
        >
          Finish Daily life
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

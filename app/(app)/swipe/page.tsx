import { redirect } from "next/navigation";
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
  // said. Saving a half-filled table is fine; swiping on one is not.
  if (!isDailyLifeComplete(profile)) redirect(FINISH_DAILY_LIFE);
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

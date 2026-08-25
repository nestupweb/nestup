import { getAuthContext, requireProfile } from "@/lib/auth";
import { getSwipeDeck } from "@/lib/swipe";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";

export default async function SwipePage() {
  // Scores come from the questionnaire, so the deck needs a finished profile.
  const { profile } = await requireProfile("/swipe");
  const { supabase } = await getAuthContext();
  const deck = await getSwipeDeck(supabase, profile);

  return (
    <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
      <SwipeDeck entries={deck} seeker={profile} />
    </main>
  );
}

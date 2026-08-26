import { getAuthContext, requireProfile } from "@/lib/auth";
import { getSwipeDeck } from "@/lib/swipe";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";

export default async function SwipePage() {
  // Scores come from the questionnaire, so the deck needs a finished profile.
  const { profile } = await requireProfile("/swipe");
  const { supabase } = await getAuthContext();
  const [deck, { data: details }] = await Promise.all([
    getSwipeDeck(supabase, profile),
    supabase.from("profile_details").select("intro_template").eq("user_id", profile.user_id).maybeSingle(),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5">
      <SwipeDeck entries={deck} seeker={profile} introTemplate={details?.intro_template ?? ""} />
    </main>
  );
}

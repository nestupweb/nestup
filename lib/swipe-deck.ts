import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deckTag } from "@/lib/cache-tags";
import { getPersonalisedDeck, type PersonalisedDeck } from "@/lib/swipe";
import type { Profile } from "@/lib/types";

/**
 * The Swipe page's whole payload, cached per member.
 *
 * This lives apart from `lib/swipe.ts` on purpose. That module is imported by
 * `IntroSheet`/`SwipeDeck`, which are client components, so anything it pulls in
 * has to be safe in a browser bundle. Putting this here — behind `server-only`
 * — keeps the cookie-reading Supabase client out of the client build, which is
 * exactly the error that appeared when it briefly lived there.
 *
 * Swipe is by far the most expensive page in the app: roughly nine round-trips
 * in three dependent waves (deck, owners and residents, blocked ids, attention
 * history), and none of it changes between visits unless the member swipes or a
 * room is published or pulled. That makes it the biggest win from caching.
 *
 * `use cache: private`, never the shared `use cache`: a deck is ranked against
 * one member's Daily-life answers and excludes the rooms *they* have already
 * swiped and the people *they* have blocked. Serving one member's deck to
 * another would leak both their taste and their block list. A private cache is
 * held only in the requesting browser, and `userId` keys the entry inside it.
 *
 * Invalidated by `deckTag(userId)`: on every swipe (a swiped room must not come
 * back), and when the member publishes, pauses or removes a room of their own.
 */
export async function getCachedDeck(
  userId: string
): Promise<(PersonalisedDeck & { introTemplate: string }) | null> {
  "use cache: private";
  cacheTag(deckTag(userId));
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const supabase = await createClient();
  const { data: row } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  const seeker = row as Profile | null;
  if (!seeker) return null;

  const [deck, { data: details }] = await Promise.all([
    getPersonalisedDeck(supabase, seeker),
    supabase.from("profile_details").select("intro_template").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    ...deck,
    introTemplate: (details as { intro_template: string } | null)?.intro_template ?? "",
  };
}

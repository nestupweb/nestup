import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Per-request memoized auth context: layouts, pages, and actions in the same
 * request share ONE auth.getUser() network round-trip instead of one each.
 */
export const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

/**
 * Is the signed-in account suspended? Memoized per request, so the extra
 * round-trip happens once however many times `requireUser` is called while
 * rendering a page.
 */
export const getSuspended = cache(async (): Promise<boolean> => {
  const { supabase, user } = await getAuthContext();
  if (!user) return false;
  const { data } = await supabase.from("suspensions").select("user_id").eq("user_id", user.id).maybeSingle();
  return Boolean(data);
});

/**
 * Every authenticated page funnels through here, so this is where a suspension
 * that landed mid-session takes effect: sign-in is refused separately, but an
 * account suspended while its owner was already using the app has to stop
 * working immediately rather than at the next login. The session cookie is
 * left alone on purpose — writing cookies from a Server Component is a no-op,
 * and RLS (migration 0029) already refuses their writes, so bouncing every
 * page is enough to close the app.
 */
export async function requireUser() {
  const { supabase, user } = await getAuthContext();
  if (!user) redirect("/login");
  if (await getSuspended()) redirect("/login?error=suspended");
  return { supabase, user };
}

/** The signed-in user's profile, or null if they haven't created one yet. */
export const getOwnProfile = cache(async (): Promise<{ profile: Profile | null; userId: string }> => {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return { profile: (data as Profile | null) ?? null, userId: user.id };
});

/**
 * For pages that require a completed profile (swipe, listing, chat).
 * Pass `next` so onboarding explains the detour and returns the user
 * to the page they were trying to reach after saving.
 */
export async function requireProfile(next?: string): Promise<{ profile: Profile; userId: string }> {
  const { profile, userId } = await getOwnProfile();
  if (!profile) {
    redirect(next ? `/profile?onboarding=1&next=${encodeURIComponent(next)}` : "/profile?onboarding=1");
  }
  return { profile, userId };
}

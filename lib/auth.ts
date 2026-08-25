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

export async function requireUser() {
  const { supabase, user } = await getAuthContext();
  if (!user) redirect("/login");
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

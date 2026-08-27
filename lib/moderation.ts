import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

/**
 * The read side of blocking and suspension. Every write lives in
 * `app/actions/moderation.ts`; the rules themselves live in migration 0029 and
 * are enforced by RLS, so nothing here is load-bearing for security — it only
 * keeps blocked people out of what the app renders.
 */

/** The wording a suspended member sees. One string, used by sign-in and the gate. */
export const SUSPENDED_MESSAGE =
  "Your account has been suspended due to improper use of the platform.";

/**
 * Everyone hidden from the caller, in both directions: the people they blocked
 * and the people who blocked them. Comes from the security-definer
 * `blocked_user_ids()` because a member may not read rows where they are the
 * blocked party.
 */
export async function getBlockedIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("blocked_user_ids");
  if (error) return new Set();
  const rows = (data as unknown as (string | { blocked_user_ids: string })[] | null) ?? [];
  return new Set(rows.map((r) => (typeof r === "string" ? r : r.blocked_user_ids)).filter(Boolean));
}

/** Is this account suspended? Reads the caller's own row, which RLS allows. */
export async function isSuspended(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("suspensions").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

/** The people the caller has blocked, newest first, for the Settings list. */
export async function getBlockedProfiles(
  supabase: SupabaseClient,
  userId: string
): Promise<{ profile: Profile; blockedAt: string }[]> {
  const { data: rows } = await supabase
    .from("blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  const blocks = (rows as { blocked_id: string; created_at: string }[] | null) ?? [];
  if (blocks.length === 0) return [];

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("*")
    .in(
      "user_id",
      blocks.map((b) => b.blocked_id)
    );
  const byId = new Map(((profileRows as Profile[] | null) ?? []).map((p) => [p.user_id, p]));
  return blocks
    .map((b) => {
      const profile = byId.get(b.blocked_id);
      return profile ? { profile, blockedAt: b.created_at } : null;
    })
    .filter((x): x is { profile: Profile; blockedAt: string } => x !== null);
}

/** Has the caller already reported this member? Used to show the state, not to enforce it. */
export async function hasReported(
  supabase: SupabaseClient,
  reporterId: string,
  reportedId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", reporterId)
    .eq("reported_id", reportedId)
    .maybeSingle();
  return Boolean(data);
}

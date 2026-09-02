import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SESSION_TAG, profileTag } from "@/lib/cache-tags";
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

/**
 * The signed-in user's profile, or null if they haven't created one yet.
 *
 * Deliberately not `requireUser()` followed by the query, which is what this
 * was: that ran three round-trips strictly one after another — `getUser`, then
 * the suspension check, then this row — and Profile could not emit a byte until
 * all three came back, which is what kept it the slowest tab even after its
 * data was cached. Only the first is a genuine dependency; the other two both
 * need nothing but the id, so they now go out together.
 *
 * The suspension gate is unchanged in effect: it is still checked before this
 * returns, so a suspended member is bounced before anything renders. The cost of
 * doing it this way is one wasted profile read for an account that turns out to
 * be suspended — RLS-scoped to them, and a rare case besides.
 */
export const getOwnProfile = cache(async (): Promise<{ profile: Profile | null; userId: string }> => {
  const { supabase, user } = await getAuthContext();
  if (!user) redirect("/login");

  const [suspended, { data }] = await Promise.all([
    getSuspended(),
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (suspended) redirect("/login?error=suspended");

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


/* -------------------------------------------------------------------------
 * Cached readers, for RENDERING ONLY
 *
 * Everything above stays uncached and is what Server Actions use. These are
 * the versions the four nav routes render with.
 *
 * Why they exist. Every signed-in page began by awaiting `auth.getUser()` — a
 * network round-trip to Supabase on every single render — and the App Shell
 * prerender advances through cached reads but stops dead at the first uncached
 * one. So that one call kept Listings, Chat and Profile out of their own App
 * Shells no matter how well their data was cached: measured on the live site,
 * a ~300ms skeleton on every return to those tabs, near-identical across all
 * three because it was the same round-trip every time.
 *
 * What this costs, decided by the user (2026-09-02): a suspension now takes
 * effect within the cache window rather than on the very next page. The check
 * is NOT removed — `suspended` is still read and still enforced — it is just
 * read at most once per window instead of once per render. The user was asked
 * about exactly this and said suspension is not important here.
 *
 * What it does NOT cost:
 *  - `proxy.ts` still calls `auth.getUser()` uncached on every request to a
 *    protected route, so a signed-out or expired session cannot reach these
 *    pages at all. That is the real gate and it is untouched.
 *  - Every Server Action still goes through `requireUser()` above, uncached.
 *    A cached identity is never what authorises a write.
 *  - RLS is untouched. Each query still runs on the cookie-bearing client, so
 *    Postgres decides what comes back regardless of what this says.
 * ---------------------------------------------------------------------- */

export type CachedSession = { id: string; email: string; suspended: boolean };

/**
 * The signed-in member's identity, cached in their own browser.
 *
 * Returns null for a visitor, which is a real answer and cached like any other
 * — hence `SESSION_TAG`, dropped the moment a session begins.
 */
export async function getCachedSession(): Promise<CachedSession | null> {
  "use cache: private";
  cacheTag(SESSION_TAG);
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("suspensions").select("user_id").eq("user_id", user.id).maybeSingle();
  return { id: user.id, email: user.email ?? "", suspended: Boolean(data) };
}

/**
 * `getOwnProfile` for rendering: identity, suspension and the profile row as
 * one cached read.
 *
 * The profile row is in here rather than fetched separately because splitting
 * them would put an uncached query straight back in front of the cached one
 * and undo the whole point.
 *
 * Note it returns rather than redirects. `redirect()` throws, and a throw
 * inside a cache scope is not something to rely on being replayed correctly —
 * so the decision is made by the caller, outside the cache.
 */
export async function getCachedOwnProfile(): Promise<
  { session: CachedSession; profile: Profile | null } | null
> {
  "use cache: private";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(SESSION_TAG);

  // Flattened deliberately: this does NOT call `getCachedSession()`.
  //
  // It used to, and that made this the app's only *nested* `use cache: private`
  // — one private cache awaiting another. Measured on the live site, Profile
  // was then the single tab still painting a ~280ms skeleton on every return
  // while Swipe, Listings and Chat were all at zero, and inlining the same
  // three reads here is what closed it. Whatever the mechanism, a private cache
  // whose first act is to await another private cache did not make it into the
  // route's App Shell.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Tagged per member as well, so saving a profile drops this alongside the
  // Profile tabs — `app/actions/profile.ts` already calls `updateTag(profileTag)`.
  cacheTag(profileTag(user.id));

  const [{ data: suspension }, { data }] = await Promise.all([
    supabase.from("suspensions").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  return {
    session: { id: user.id, email: user.email ?? "", suspended: Boolean(suspension) },
    profile: (data as Profile | null) ?? null,
  };
}

/** The gate alone, for routes that need no profile row (Chat is browsable without one). */
export async function requireCachedSession(): Promise<CachedSession> {
  const session = await getCachedSession();
  if (!session) redirect("/login");
  if (session.suspended) redirect("/login?error=suspended");
  return session;
}

/**
 * The render-time gate: the same redirects `requireUser`/`getOwnProfile` make,
 * driven by the cached read. Callers get the profile they were going to fetch
 * anyway.
 */
export async function requireCachedProfile(): Promise<{ session: CachedSession; profile: Profile | null }> {
  const result = await getCachedOwnProfile();
  if (!result) redirect("/login");
  if (result.session.suspended) redirect("/login?error=suspended");
  return result;
}

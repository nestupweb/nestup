import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Cache Components (Next 16). Unlocks `use cache: private` — the only cache
   * here that may read cookies, and one that is kept in the requesting
   * browser's memory instead of a shared server store, so one member's rooms,
   * chats or profile can never be served to another. Paired with `cacheTag` it
   * also replaces the blanket `revalidatePath` calls the actions used to make,
   * which rebuilt Chat and Profile every time a listing changed.
   *
   * Adopted route by route: the four nav destinations are converted, and every
   * other route carries `instant = false` until it gets the same treatment.
   */
  cacheComponents: true,
  /**
   * Prefetch each route's App Shell as its links come into view, rather than
   * all-or-nothing. This is the half that makes the caches above pay off on a
   * click: a `use cache: private` result can ride along in the prefetch and be
   * in the browser before the tab is tapped, instead of being fetched after it.
   * One shell per route is shared by every link pointing at it, so the bottom
   * nav costs four prefetches for the whole app rather than one per link.
   */
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Listing form accepts up to 5 photos × 5MB (+ multipart overhead);
      // the default 1MB cap silently killed profile/listing saves with photos.
      bodySizeLimit: "30mb",
    },
    /**
     * Every signed-in route is dynamic (`lib/supabase/server.ts` reads cookies)
     * and has a `loading.tsx`, and for that combination Next's client cache TTL
     * defaults to 0 — so every Swipe→Chat→Profile tap threw the payload away and
     * re-fetched from scratch.
     *
     * 300s, raised from 30. Thirty seconds covers a tab-to-tab flick and
     * nothing else: read one chat thread, spend a minute on a listing, and
     * going back to Swipe was a cold navigation with the skeleton again — the
     * exact "I already loaded this page" case this is supposed to answer. It
     * now matches the `stale: 300` on the reads themselves, so the router cache
     * and the data caches expire together instead of one undercutting the other.
     *
     * This is a *client* cache of rendered payloads, and unlike the `use cache`
     * entries it is not keyed by member — which is why `signOutAction` forces a
     * full document load rather than a soft redirect. Widening the window
     * without that would have widened how long one member's rendered pages sit
     * in the tab after they sign out. A mutation still clears this immediately.
     */
    staleTimes: { dynamic: 300, static: 180 },
  },
  images: {
    remotePatterns: [
      // Seed/demo photos. Unsplash URLs carry ?w=&q= params, so `search` stays unset.
      { protocol: "https", hostname: "images.unsplash.com" },
      // Supabase storage public objects (listing photos, avatars).
      {
        protocol: "https",
        hostname: "eiykciushbnbwpxpvybi.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;

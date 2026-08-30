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
     * re-fetched from scratch. 30s is long enough that moving between the four
     * tabs reuses what was just loaded, short enough that nothing looks stale;
     * a mutation clears this cache immediately regardless (see the actions).
     */
    staleTimes: { dynamic: 30, static: 180 },
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

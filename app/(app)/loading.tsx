"use client";

import { usePathname } from "next/navigation";

/**
 * Instant loading state for every signed-in route. Living at the route-group
 * level matters: Next prefetches the bottom-nav links down to the first
 * loading boundary, so a tab tap paints this skeleton (and the page slide)
 * immediately while Swipe / Chat / Profile stream in — Chat's inbox is loaded
 * by `chat/layout.tsx`, which sits *below* this boundary and is therefore
 * always fetched fresh rather than served from the prefetch cache. The
 * pathname picks a skeleton that mirrors the destination's layout.
 */
export default function AppLoading() {
  const pathname = usePathname();
  if (pathname.startsWith("/swipe")) return <SwipeSkeleton />;
  if (pathname.startsWith("/chat")) return <ChatSkeleton />;
  if (pathname.startsWith("/profile")) return <ProfileSkeleton />;
  return <GenericSkeleton />;
}

const pulse = "animate-pulse rounded bg-hairline";

function SwipeSkeleton() {
  return (
    <main className="mx-auto w-full max-w-2xl pb-4 sm:px-6 sm:pt-5" aria-busy="true" aria-label="Loading rooms">
      <div className="relative aspect-[3/4] max-h-[70dvh] w-full overflow-hidden bg-hairline animate-pulse sm:rounded-3xl">
        <div className="absolute left-4 top-4 flex flex-col gap-2">
          <div className="h-9 w-40 rounded-full bg-surface/60" />
          <div className="h-9 w-36 rounded-full bg-surface/60" />
        </div>
        <div className="absolute bottom-5 right-5 flex gap-3">
          <div className="h-14 w-14 rounded-full bg-surface/70" />
          <div className="h-14 w-14 rounded-full bg-surface/70" />
        </div>
      </div>
      <div className="px-4 pt-5 sm:px-0">
        <div className="flex gap-5">
          <div className={`h-4 w-20 ${pulse}`} />
          <div className={`h-4 w-14 ${pulse}`} />
          <div className={`h-4 w-24 ${pulse}`} />
        </div>
        <div className={`mt-6 h-3 w-24 ${pulse}`} />
        <div className={`mt-2 h-7 w-56 ${pulse}`} />
        <div className={`mt-2 h-4 w-40 ${pulse}`} />
      </div>
    </main>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]" aria-busy="true" aria-label="Loading chats">
      <div className="w-full border-hairline lg:border-r">
        <div className="px-4 pb-3 pt-4 sm:px-6">
          <div className={`h-8 w-24 ${pulse}`} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-hairline" />
            <div className="min-w-0 flex-1">
              <div className={`h-4 w-2/5 ${pulse}`} />
              <div className={`mt-2 h-3 w-4/5 ${pulse}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block" />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <main className="px-4 pb-8 pt-2 sm:px-6" aria-busy="true" aria-label="Loading profile">
      <div className="flex items-start justify-between gap-4">
        <div className={`h-10 w-36 ${pulse}`} />
        <div className="h-10 w-10 animate-pulse rounded-full border border-hairline" />
      </div>
      <div className="mt-5 flex items-center gap-4">
        <div className="h-28 w-28 shrink-0 animate-pulse rounded-full bg-hairline" />
        <div className="min-w-0 flex-1">
          <div className={`h-6 w-44 ${pulse}`} />
          <div className={`mt-2 h-4 w-28 ${pulse}`} />
          <div className={`mt-3 h-4 w-3/4 ${pulse}`} />
        </div>
      </div>
      <div className="mt-8 flex gap-6 border-b border-hairline pb-3">
        <div className={`h-3 w-16 ${pulse}`} />
        <div className={`h-3 w-20 ${pulse}`} />
        <div className={`h-3 w-12 ${pulse}`} />
        <div className={`h-3 w-16 ${pulse}`} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full border border-hairline" />
        ))}
      </div>
      <div className={`mt-6 h-4 w-3/4 ${pulse}`} />
      <div className={`mt-2 h-4 w-1/2 ${pulse}`} />
      <div className={`mt-8 h-3 w-24 ${pulse}`} />
      <div className={`mt-4 h-3 w-20 ${pulse}`} />
      <div className={`mt-2 h-5 w-40 ${pulse}`} />
      <div className={`mt-4 h-3 w-24 ${pulse}`} />
      <div className={`mt-2 h-5 w-28 ${pulse}`} />
    </main>
  );
}

function GenericSkeleton() {
  return (
    <main className="px-4 pb-8 pt-2 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className={`h-10 w-48 ${pulse}`} />
      <div className={`mt-3 h-4 w-72 max-w-full ${pulse}`} />
      <div className="mt-6 h-40 animate-pulse rounded-2xl border border-hairline bg-surface" />
      <div className="mt-4 h-40 animate-pulse rounded-2xl border border-hairline bg-surface" />
    </main>
  );
}

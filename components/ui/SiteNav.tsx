import { Suspense } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { UnreadBadge } from "@/components/ui/UnreadBadge";
import { getAuthContext } from "@/lib/auth";

/**
 * The bottom nav, mounted once from the ROOT layout.
 *
 * It used to be rendered by `(app)/layout.tsx` and `(public)/layout.tsx`
 * separately. Those are sibling route groups, so going from Swipe/Chat/Profile
 * to Listings tore the whole `(app)` subtree down and built `(public)`'s — the
 * nav unmounted and remounted on every crossing. `(public)` then made it
 * visible: its copy sat behind `<Suspense fallback={null}>` around an async
 * auth check, so the gap lasted a `getUser()` round-trip rather than a frame,
 * and the nav visibly blinked out and came back.
 *
 * From the root layout it sits above both groups, so a client-side navigation
 * never unmounts it — the tab highlight just moves. The auth check costs
 * nothing extra: `getAuthContext` is `cache()`d per request and every signed-in
 * page already awaits it, so this shares that one round-trip.
 *
 * Kept out of `<PageTransition>` on purpose. That is keyed on the pathname, so
 * anything inside it is part of the exit/enter pair; the nav has to be the one
 * fixed thing the pages move behind.
 */
export async function SiteNav() {
  const { user } = await getAuthContext();
  if (!user) return null;

  return (
    <BottomNav
      unreadSlot={
        <Suspense fallback={null}>
          <UnreadBadge />
        </Suspense>
      }
    />
  );
}

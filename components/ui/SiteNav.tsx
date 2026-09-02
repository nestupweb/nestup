import { Suspense } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { UnreadBadge } from "@/components/ui/UnreadBadge";
import { getCachedSession } from "@/lib/auth";

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
 * nothing extra: this is the cached session, so on a warm cache it costs no
 * round-trip at all. It used to be `getAuthContext()` — an uncached
 * `auth.getUser()` in the ROOT layout, and therefore on every route in the app.
 *
 * Kept out of `<PageTransition>` on purpose. That is keyed on the pathname, so
 * anything inside it is part of the exit/enter pair; the nav has to be the one
 * fixed thing the pages move behind.
 */
export async function SiteNav() {
  const session = await getCachedSession();
  if (!session) return null;

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

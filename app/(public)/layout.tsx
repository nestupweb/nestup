import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MemberActions } from "@/components/ui/MemberActions";
import { Suspense } from "react";
import { getCachedSession } from "@/lib/auth";

/**
 * Not async, unlike the version this replaces.
 *
 * `/browse` is the app's public front door, so it is the page most worth
 * prerendering — and awaiting `auth.getUser()` here meant none of it could be.
 * Only one spot here differs by session — `SessionActions`, the gear and Log
 * out for a member or the Log in / Sign up pills for a visitor — and it sits
 * behind its own `<Suspense>`, so the wordmark, the theme toggle and the page
 * itself ship in the static shell.
 *
 * The bottom nav is no longer one of them. It used to stream in here behind a
 * `fallback={null}`, which is what made it blink out for a `getUser()`
 * round-trip every time someone came over from Swipe or Chat. It is mounted
 * once from the root layout now — see `SiteNav`.
 *
 * The bottom padding stays unconditional: it is the height of the floating nav,
 * and reserving it for signed-out visitors too costs one empty strip at the
 * foot of the page but keeps the shell static and stops the layout jumping.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-28">
      <header className="border-b border-hairline" style={{ viewTransitionName: "site-header" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="NestUp home" className="flex items-center text-ink">
            <Logo className="h-7" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Suspense fallback={null}>
              <SessionActions />
            </Suspense>
          </div>
        </div>
      </header>
      {/* pt-6: a breath between the header's hairline and whatever the page starts with. */}
      <div className="mx-auto w-full max-w-6xl pt-6">
        <BackButton />
        {children}
      </div>
    </div>
  );
}

/**
 * The half of the header that depends on who is looking: a signed-in member
 * gets the settings gear and Log out they have on every other page (2026-08-30
 * — Listings used to leave them with the theme toggle alone), a visitor gets
 * Log in / Sign up.
 */
async function SessionActions() {
  // Cached: this was the last uncached `auth.getUser()` on the Listings route,
  // and /browse is the page most worth prerendering.
  const session = await getCachedSession();
  if (session) return <MemberActions />;
  return (
    <>
      <Link href="/login" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast">Log in</Link>
      {/* Quieter than Log in so the two pills don't compete for the same glance. */}
      <Link
        href="/signup"
        className="rounded-full border border-hairline px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
      >
        Sign up
      </Link>
    </>
  );
}


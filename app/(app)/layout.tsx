import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SettingsLink } from "@/components/ui/GearIcon";
import { Suspense } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { UnreadBadge } from "@/components/ui/UnreadBadge";
import { signOutAction } from "@/app/actions/auth";

/**
 * Deliberately not async, and it reads no session.
 *
 * Everything here is the same for every signed-in member — the wordmark, the
 * theme toggle, the gear, Log out, the nav — so none of it needs to wait for
 * `auth.getUser()`. It used to await one anyway, which meant no signed-in page
 * could send a single byte until that round-trip came back. Now the whole shell
 * is static and ships in the prerender, and only the unread badge (which
 * renders nothing when there is no session) waits behind its own boundary.
 *
 * Access is not weakened by dropping the check: `proxy.ts` gates every route
 * under this group at the edge, and each page still calls `requireUser()`.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-28">
      <header className="border-b border-hairline" style={{ viewTransitionName: "site-header" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/browse" aria-label="NestUp home" className="flex items-center text-ink">
            <Logo className="h-7" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SettingsLink />
            <form action={signOutAction}>
              <button className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted hover:text-ink">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl">
        <BackButton />
        {children}
      </div>
      <BottomNav
        unreadSlot={
          <Suspense fallback={null}>
            <UnreadBadge />
          </Suspense>
        }
      />
    </div>
  );
}

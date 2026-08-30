import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Suspense } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { UnreadBadge } from "@/components/ui/UnreadBadge";
import { getAuthContext } from "@/lib/auth";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuthContext();

  return (
    <div className={`min-h-dvh ${user ? "pb-28" : ""}`}>
      <header className="border-b border-hairline" style={{ viewTransitionName: "site-header" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="NestUp home" className="flex items-center text-ink">
            <Logo className="h-7" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? null : (
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
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl">
        <BackButton />
        {children}
      </div>
      {user ? (
        <BottomNav
          unreadSlot={
            <Suspense fallback={null}>
              <UnreadBadge />
            </Suspense>
          }
        />
      ) : null}
    </div>
  );
}

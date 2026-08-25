import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BottomNav } from "@/components/ui/BottomNav";
import { getAuthContext } from "@/lib/auth";
import { getUnreadCount } from "@/lib/chat";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuthContext();
  const unread = user ? await getUnreadCount() : 0;

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
              <Link href="/login" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast">Log in</Link>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl">
        <BackButton />
        {children}
      </div>
      {user ? <BottomNav unread={unread} /> : null}
    </div>
  );
}

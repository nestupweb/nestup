import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BottomNav } from "@/components/ui/BottomNav";
import { signOutAction } from "@/app/actions/auth";
import { getAuthContext } from "@/lib/auth";
import { getUnreadCount } from "@/lib/chat";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuthContext();
  const unread = user ? await getUnreadCount() : 0;

  return (
    <div className="min-h-dvh pb-28">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/browse" className="text-xl font-semibold">
            Nest<span className="italic font-normal text-accent">Up</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <button className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted hover:text-ink">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
      <BottomNav unread={unread} />
    </div>
  );
}

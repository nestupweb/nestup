import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { HeaderNav, TabBar } from "@/components/ui/TabBar";
import { signOutAction } from "@/app/actions/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-20 md:pb-12">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
          <Link href="/swipe" className="font-serif text-xl font-semibold">
            Nest<span className="italic font-normal text-accent">Up</span>
          </Link>
          <HeaderNav />
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
      <TabBar />
    </div>
  );
}

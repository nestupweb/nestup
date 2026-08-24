import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TabBar } from "@/components/ui/TabBar";
import { signOutAction } from "@/app/actions/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-20">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/swipe" className="font-serif text-xl font-semibold">
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
      </header>
      {children}
      <TabBar />
    </div>
  );
}

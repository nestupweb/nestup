import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="font-serif text-xl font-semibold">
            Nest<span className="italic font-normal text-accent">Up</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/browse" className="px-2 text-sm text-muted hover:text-ink">Browse</Link>
            {user ? (
              <Link href="/swipe" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast">Open app</Link>
            ) : (
              <Link href="/login" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast">Log in</Link>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </div>
  );
}

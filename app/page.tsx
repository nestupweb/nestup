import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Interim landing page: Task 15 replaces this with the full landing
// (photography, featured listings, browse entry points).
export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="font-serif text-xl font-semibold tracking-tight">NestUp</span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center pb-24">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Shared apartments, matched roommates
        </p>
        <h1 className="mt-4 max-w-xl font-serif text-5xl font-semibold leading-tight">
          Find the room — and the people you&rsquo;ll actually get along with.
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-muted">
          Browse rooms openly, swipe when you&rsquo;re ready, and match with listers who
          like you back. Two compatibility scores — lifestyle and shared interests —
          help both sides decide. You always choose.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-hairline px-5 py-2.5 text-sm font-medium text-ink hover:border-accent"
          >
            Log in
          </Link>
        </div>

        <p className="mt-10 border-t border-hairline pt-5 text-xs leading-6 text-muted">
          Listings are open to everyone — swiping, matching, and chat unlock when you
          sign in. Full browsing experience arriving as the build continues.
        </p>
      </main>
    </div>
  );
}

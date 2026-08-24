import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Interim signed-in destination: Task 16 replaces this with the real swipe deck.
export default async function SwipePage() {
  const { user } = await requireUser();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          NestUp
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center pb-24">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Signed in as {user.email}
        </p>
        <h1 className="mt-4 max-w-xl font-serif text-4xl font-semibold leading-tight">
          You&rsquo;re in.
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-muted">
          Your account works end to end — sign-up, email confirmation, and login are
          all live. The swipe deck, profiles, listings, and matches are being built
          next and will appear right here.
        </p>

        <form action={signOutAction} className="mt-8">
          <button
            type="submit"
            className="rounded-xl border border-hairline px-5 py-2.5 text-sm font-medium text-ink hover:border-accent"
          >
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}

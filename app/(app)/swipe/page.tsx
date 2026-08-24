import { requireUser } from "@/lib/auth";

// Interim signed-in destination: Task 16 replaces this with the real swipe deck.
export default async function SwipePage() {
  const { user } = await requireUser();

  return (
    <main className="px-5 py-10">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">
        Signed in as {user.email}
      </p>
      <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight">
        You&rsquo;re in.
      </h1>
      <p className="mt-5 max-w-md text-base leading-7 text-muted">
        The swipe deck is being built next and will appear right here.
      </p>
    </main>
  );
}

"use client";

import { useEffect } from "react";

export default function BrowseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="px-5 pb-16 pt-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        We couldn&rsquo;t load the listings right now. Please try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-accent-contrast"
      >
        Try again
      </button>
    </main>
  );
}

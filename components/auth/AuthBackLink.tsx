"use client";

import { useRouter } from "next/navigation";
import { canGoBack } from "@/lib/back";

/**
 * "← Back" at the top-left of an auth screen that has taken the page over —
 * today that is "Check your inbox", which replaces the signup form in place
 * (same URL, React state), so the browser's own back arrow is the only way
 * out and nothing on screen says so.
 *
 * Deliberately not `BackButton`: that one names the page it returns to from
 * the in-app trail, and an auth screen is usually the first page of a tab —
 * arriving from an e-mail, a bookmark or a shared link — so there is often no
 * trail to name. Same arrow, same accent, same size; it just says "Back" and
 * falls back to `fallback` when this tab has no history to go back to.
 */
export function AuthBackLink({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  const back = () => {
    if (canGoBack()) router.back();
    else router.push(fallback);
  };

  return (
    <div className="mx-auto flex h-[2.375rem] w-full max-w-6xl items-end px-4 pb-1 pt-6 sm:px-6">
      <button
        type="button"
        onClick={back}
        aria-label="Back"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-accent underline-offset-4 hover:underline"
      >
        <span aria-hidden="true">←</span>
        Back
      </button>
    </div>
  );
}

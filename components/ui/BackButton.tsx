"use client";

import { usePathname, useRouter } from "next/navigation";
import { canGoBack, parentPath } from "@/lib/back";

/**
 * Top-left "Back" on every page: returns to the previous page when there is
 * one, otherwise to the page's parent (see parentPath). Hidden on the landing
 * page, which has nowhere to go back to.
 */
export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/") return null;

  const back = () => {
    if (canGoBack()) router.back();
    else router.push(parentPath(pathname));
  };

  return (
    <button
      type="button"
      onClick={back}
      aria-label="Back"
      title="Back"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-accent hover:text-accent ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

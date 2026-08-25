"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canGoBack, markGoingBack, pageName, parentPath, previousVisit, recordVisit, subscribeTrail } from "@/lib/back";

/**
 * "← Back to chats" under the site header, top-left of every page. Names the
 * page this tab came from (the in-app trail in lib/back) and returns to it
 * through the browser's history; on a direct link there is no trail, so it
 * names and opens the page's parent instead. Listings is the front door
 * (`/` redirects there), so with nothing to return to it stays hidden.
 * Styled like the Swipe panel's "Full listing →" link, pointing the other way.
 */
export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    recordVisit(pathname);
  }, [pathname]);
  useEffect(() => {
    const onPop = () => markGoingBack();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const prev = useSyncExternalStore(subscribeTrail, () => previousVisit(pathname), () => null);
  if (pathname === "/" || (pathname === "/browse" && !prev)) return null;

  const target = prev ?? parentPath(pathname);
  const label = `Back to ${pageName(target)}`;
  const back = () => {
    if (prev && canGoBack()) {
      markGoingBack();
      router.back();
    } else {
      router.push(target);
    }
  };

  return (
    <div className={`flex h-[2.375rem] items-end px-4 pb-1 sm:px-6 ${className}`}>
      <button
        type="button"
        onClick={back}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent underline-offset-4 hover:underline"
      >
        <span aria-hidden="true">←</span>
        {label}
      </button>
    </div>
  );
}

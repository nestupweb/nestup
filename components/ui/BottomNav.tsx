"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { navTransitionTypes } from "@/lib/nav-direction";

type IconName = "swipe" | "listings" | "chat" | "profile";

const ITEMS: readonly { href: string; label: string; icon: IconName }[] = [
  { href: "/swipe", label: "Swipe", icon: "swipe" },
  { href: "/browse", label: "Listings", icon: "listings" },
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

const ICONS: Record<IconName, JSX.Element> = {
  swipe: (
    <>
      <rect x="6" y="3.5" width="12" height="17" rx="2.5" />
      <path d="M3.5 7v10M20.5 7v10" />
    </>
  ),
  listings: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.8V20h13V9.8" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  chat: (
    <>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5Z" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
};

/**
 * Floating, pill-shaped primary navigation. Hidden on small screens while a
 * chat thread is open (the composer needs the bottom edge, WhatsApp-style).
 * Each link carries a view-transition type (forward/back by tab order) so the
 * page slides the matching way; the active highlight is a named element so
 * the browser glides it between tabs. The nav itself is anchored in place
 * during transitions (see `bottom-nav` in globals.css).
 *
 * `unreadSlot` is a node, not a number: the count comes from an extra RPC, and
 * awaiting it in the layout held the entire signed-in shell behind it. The
 * layout now passes `<Suspense><UnreadBadge /></Suspense>`, so the nav paints
 * immediately and the pill drops in when the count lands.
 */
export function BottomNav({ unreadSlot }: { unreadSlot?: ReactNode }) {
  const pathname = usePathname();
  const inThread = /^\/chat\/[^/]+/.test(pathname);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label="Primary"
      style={{ viewTransitionName: "bottom-nav" }}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
        inThread ? "hidden lg:flex" : "flex"
      }`}
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center justify-around rounded-full border border-hairline bg-surface/85 px-1.5 py-1.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              transitionTypes={navTransitionTypes(pathname, item.href)}
              className={`relative isolate flex min-w-[4.5rem] flex-col items-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                active ? "text-accent" : "text-muted hover:text-ink"
              }`}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  data-testid="nav-active-pill"
                  style={{ viewTransitionName: "nav-active-pill" }}
                  className="absolute inset-0 -z-10 rounded-full bg-accent/10"
                />
              ) : null}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                {ICONS[item.icon]}
              </svg>
              {item.label}
              {item.href === "/chat" ? unreadSlot : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

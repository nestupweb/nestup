"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/swipe", label: "Swipe" },
  { href: "/browse", label: "Browse" },
  { href: "/matches", label: "Matches" },
  { href: "/listing", label: "Listing" },
  { href: "/profile", label: "Profile" },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

/** Desktop variant: inline nav inside the app header (hidden below md). */
export function HeaderNav() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-6 md:flex lg:gap-8">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`text-xs font-semibold uppercase tracking-widest transition-colors ${
            isActive(t.href) ? "text-accent" : "text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile variant: fixed bottom tab bar (hidden on md+, where HeaderNav takes over). */
export function TabBar() {
  const isActive = useIsActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg justify-around py-2.5">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`text-[10px] font-semibold uppercase tracking-widest ${
              isActive(t.href) ? "text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

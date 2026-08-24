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

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg justify-around py-2.5">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`text-[10px] font-semibold uppercase tracking-widest ${
                active ? "text-accent" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

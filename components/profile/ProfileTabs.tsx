"use client";

import Link from "next/link";
import { useState } from "react";
import { PropertyTile } from "@/components/listings/PropertyTile";
import type { Listing } from "@/lib/types";

type TabKey = "listings" | "liked" | "history";

export interface ProfileTabItem {
  listing: Listing;
  caption?: string;
}

export function ProfileTabs({
  mine,
  liked,
  history,
  initial = "listings",
}: {
  mine: ProfileTabItem[];
  liked: ProfileTabItem[];
  history: ProfileTabItem[];
  initial?: TabKey;
}) {
  const [tab, setTab] = useState<TabKey>(initial);

  const TABS: { key: TabKey; label: string; items: ProfileTabItem[] }[] = [
    { key: "listings", label: "My Listings", items: mine },
    { key: "liked", label: "Liked", items: liked },
    { key: "history", label: "History", items: history },
  ];
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div>
      <div role="tablist" aria-label="Profile sections" className="flex gap-7 border-b border-hairline">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`-mb-px flex items-baseline gap-1.5 border-b-2 pb-2.5 font-serif text-lg transition-colors ${
                active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
              <span className={`text-xs ${active ? "text-accent" : "text-muted"}`}>{t.items.length}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${current.key}`} aria-labelledby={`tab-${current.key}`} className="mt-5">
        {current.items.length === 0 ? (
          <Empty tab={current.key} />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
            {current.items.map(({ listing, caption }) => (
              <PropertyTile
                key={listing.id}
                listing={listing}
                badge={current.key === "listings" && !listing.is_active ? "Paused" : undefined}
                caption={caption}
              />
            ))}
            {current.key === "listings" ? <AddTile /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function AddTile() {
  return (
    <Link
      href="/listing"
      className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline text-muted transition-colors hover:border-accent hover:text-accent"
    >
      <span className="text-3xl font-light leading-none">+</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest">Edit listing</span>
    </Link>
  );
}

function Empty({ tab }: { tab: TabKey }) {
  const copy = {
    listings: { title: "No listings yet", hint: "Post a room and interested seekers will find you.", href: "/listing", cta: "List a room" },
    liked: { title: "Nothing liked yet", hint: "Tap the heart on any room to keep it here.", href: "/browse", cta: "Browse rooms" },
    history: { title: "No history yet", hint: "Rooms you open will show up here.", href: "/browse", cta: "Browse rooms" },
  }[tab];
  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <p className="font-serif text-2xl font-semibold">{copy.title}</p>
      <p className="mt-2 text-sm text-muted">{copy.hint}</p>
      <Link
        href={copy.href}
        className="mt-5 inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast"
      >
        {copy.cta}
      </Link>
    </div>
  );
}

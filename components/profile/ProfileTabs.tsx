"use client";

import Link from "next/link";
import { useState } from "react";
import { PropertyTile } from "@/components/listings/PropertyTile";
import { AboutMe } from "@/components/profile/AboutMe";
import type { Listing, Profile, ProfileDetails } from "@/lib/types";

export type TabKey = "about" | "listings" | "liked" | "history";

export interface ProfileTabItem {
  listing: Listing;
  caption?: string;
}

export function ProfileTabs({
  mine,
  liked,
  history,
  initial = "about",
  about,
}: {
  mine: ProfileTabItem[];
  liked: ProfileTabItem[];
  history: ProfileTabItem[];
  initial?: TabKey;
  /** Data for the About me tab (own profile only). */
  about: { profile: Profile; details: ProfileDetails | null; email: string };
}) {
  const [tab, setTab] = useState<TabKey>(initial);

  const TABS: { key: TabKey; label: string; items: ProfileTabItem[] | null }[] =
    [
      { key: "about", label: "About me", items: null },
      { key: "listings", label: "My Listings", items: mine },
      { key: "liked", label: "Liked", items: liked },
      { key: "history", label: "History", items: history },
    ];
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div>
      {/* Same header treatment as the Swipe panel tabs. */}
      <div className="border-b border-hairline">
        <div
          role="tablist"
          aria-label="Profile sections"
          className="no-scrollbar -mb-px flex gap-4 overflow-x-auto pb-px sm:gap-7"
        >
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
                className={`-mb-px flex items-baseline gap-1.5 whitespace-nowrap border-b-2 pb-3 text-[12px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
                {t.items ? (
                  <span
                    className={`text-[11px] tracking-normal ${active ? "text-accent" : "text-muted"}`}
                  >
                    {t.items.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-${current.key}`}
        aria-labelledby={`tab-${current.key}`}
        className="mt-5"
      >
        {current.items === null ? (
          <AboutMe
            profile={about.profile}
            details={about.details}
            email={about.email}
          />
        ) : current.items.length === 0 ? (
          <Empty tab={current.key as Exclude<TabKey, "about">} />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
            {current.items.map(({ listing, caption }) => (
              <PropertyTile
                key={listing.id}
                listing={listing}
                badge={
                  current.key === "listings" && !listing.is_active
                    ? "Paused"
                    : undefined
                }
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
      <span className="text-[11px] font-semibold uppercase tracking-widest">
        Edit listing
      </span>
    </Link>
  );
}

function Empty({ tab }: { tab: Exclude<TabKey, "about"> }) {
  const copy = {
    listings: {
      title: "No listings yet",
      hint: "Post a room and interested seekers will find you.",
      href: "/listing",
      cta: "List a room",
    },
    liked: {
      title: "Nothing liked yet",
      hint: "Tap the heart on any room to keep it here.",
      href: "/browse",
      cta: "Browse rooms",
    },
    history: {
      title: "No history yet",
      hint: "Rooms you open will show up here.",
      href: "/browse",
      cta: "Browse rooms",
    },
  }[tab];
  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <p className="text-2xl font-semibold">{copy.title}</p>
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

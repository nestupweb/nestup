"use client";

import Link from "next/link";
import { useState } from "react";
import { PropertyTile } from "@/components/listings/PropertyTile";
import { AboutMe } from "@/components/profile/AboutMe";
import { AboutView } from "@/components/profile/AboutView";
import { MyListing } from "@/components/profile/MyListing";
import type { PendingInvite } from "@/lib/co-posters";
import type { Listing, Profile, ProfileDetails } from "@/lib/types";

export type TabKey = "about" | "listings" | "liked" | "history";

export interface ProfileTabItem {
  listing: Listing;
  caption?: string;
  /** History only: whether this room is currently in Liked (fills the heart). */
  saved?: boolean;
}

export function ProfileTabs({
  mine,
  liked,
  history,
  initial = "about",
  about,
  invites = [],
  shared = [],
}: {
  mine: ProfileTabItem[];
  liked: ProfileTabItem[];
  history: ProfileTabItem[];
  initial?: TabKey;
  /** Data for the About me tab (own profile only). */
  about: { profile: Profile; details: ProfileDetails | null; email: string; readOnly?: boolean };
  /** Unanswered co-poster invitations, shown at the top of My Listings. */
  invites?: PendingInvite[];
  /** Rooms this member co-posts. */
  shared?: Listing[];
}) {
  const [tab, setTab] = useState<TabKey>(initial);

  // "My Listings" carries no count — the tab itself says what is there — but an
  // invitation is waiting on an answer, so that one number is worth showing
  // without making the member open the tab to find it.
  const TABS: { key: TabKey; label: string; items: ProfileTabItem[] | null; count?: boolean; badge?: number }[] =
    [
      { key: "about", label: "About me", items: null },
      { key: "listings", label: "My Listings", items: mine, count: false, badge: invites.length },
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
                {t.items && t.count !== false ? (
                  <span
                    className={`text-[11px] tracking-normal ${active ? "text-accent" : "text-muted"}`}
                  >
                    {t.items.length}
                  </span>
                ) : null}
                {t.badge ? (
                  <span
                    aria-label={`${t.badge} invitation${t.badge === 1 ? "" : "s"} waiting`}
                    className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold tracking-normal text-accent-contrast"
                  >
                    {t.badge}
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
          about.readOnly ? (
            <AboutView profile={about.profile} details={about.details} self />
          ) : (
            <AboutMe profile={about.profile} details={about.details} email={about.email} />
          )
        ) : current.key === "listings" ? (
          <MyListing listings={mine.map((m) => m.listing)} invites={invites} shared={shared} />
        ) : current.items.length === 0 ? (
          <Empty tab={current.key as Exclude<TabKey, "listings" | "about">} />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
            {current.items.map(({ listing, caption, saved }) => (
              <PropertyTile
                key={listing.id}
                listing={listing}
                caption={caption}
                // Liked: a filled heart on each tile — tap to unlike, tap again to like back.
                // History: the same heart, filled only for rooms that are also in Liked.
                heart={
                  current.key === "liked"
                    ? { signedIn: true, saved: true }
                    : current.key === "history"
                      ? { signedIn: true, saved: saved ?? false }
                      : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ tab }: { tab: Exclude<TabKey, "listings" | "about"> }) {
  const copy = {
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
      <p className="text-2xl font-bold">{copy.title}</p>
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

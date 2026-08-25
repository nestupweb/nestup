"use client";

import Link from "next/link";
import { useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { DetailIcon, type DetailIconName } from "@/components/listings/DetailIcon";
import { FEATURES, propertyTypeLabel } from "@/lib/constants";
import { formatMoveIn, sharedInterests, type DeckEntry } from "@/lib/swipe";
import type { Profile } from "@/lib/types";

const PAGES = [
  { key: "essentials", label: "Essentials" },
  { key: "home", label: "Home" },
  { key: "flatmates", label: "Flatmates" },
] as const;

const AMENITY_ICONS: Record<string, DetailIconName> = {
  balcony: "balcony",
  air_conditioning: "snowflake",
  parking: "parking",
  elevator: "elevator",
  furnished: "sofa",
};

const eyebrow = "text-[10px] font-semibold uppercase tracking-[0.2em] text-muted";
const SWIPE_THRESHOLD = 48;

/** Full-width, three-page information panel under the photo stage. */
export function SwipePanel({
  entry,
  seeker,
  page,
  onPageChange,
}: {
  entry: DeckEntry;
  seeker: Profile;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const last = PAGES.length - 1;
  const go = (next: number) => onPageChange(Math.min(last, Math.max(0, next)));

  return (
    <section aria-label="Room information" className="bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 pt-4">
        <div role="tablist" aria-label="Information pages" className="flex gap-4 sm:gap-6">
          {PAGES.map((p, i) => {
            const active = i === page;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                id={`swipe-tab-${p.key}`}
                aria-selected={active}
                aria-controls={`swipe-panel-${p.key}`}
                onClick={() => onPageChange(i)}
                className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                  active ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="mb-2 flex items-center gap-1.5">
          <PagerButton label="Previous page" disabled={page === 0} onClick={() => go(page - 1)}>
            <path d="M14.5 6 9 12l5.5 6" />
          </PagerButton>
          <PagerButton label="Next page" disabled={page === last} onClick={() => go(page + 1)}>
            <path d="M9.5 6 15 12l-5.5 6" />
          </PagerButton>
        </div>
      </div>

      <div
        key={PAGES[page].key}
        role="tabpanel"
        id={`swipe-panel-${PAGES[page].key}`}
        aria-labelledby={`swipe-tab-${PAGES[page].key}`}
        className="panel-enter min-h-[220px] px-5 py-5"
        onTouchStart={(e) => {
          touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
          go(dx < 0 ? page + 1 : page - 1);
        }}
      >
        {page === 0 ? <Essentials entry={entry} /> : page === 1 ? <Home entry={entry} /> : <Flatmates entry={entry} seeker={seeker} />}
      </div>
    </section>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-30 disabled:hover:border-hairline disabled:hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/* ---------- page 1: address, price, move-in ---------- */
function Essentials({ entry }: { entry: DeckEntry }) {
  const { listing } = entry;
  const street = listing.address || listing.neighborhood || listing.title;
  const locality = [listing.neighborhood && listing.address ? listing.neighborhood : null, listing.city]
    .filter(Boolean)
    .join(", ");
  return (
    <div>
      <p className={eyebrow}>{propertyTypeLabel(listing.property_type)}</p>
      <h2 className="mt-2 font-serif text-[26px] font-semibold leading-tight sm:text-3xl">{street}</h2>
      <p className="mt-1 text-sm text-muted">{locality}</p>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-hairline pt-5">
        <div>
          <dt className={eyebrow}>Monthly</dt>
          <dd className="mt-1.5 font-serif text-2xl font-semibold">
            ₪{listing.rent.toLocaleString()}
            <span className="text-sm font-normal text-muted"> / mo</span>
          </dd>
        </div>
        <div>
          <dt className={eyebrow}>Move in</dt>
          <dd className="mt-1.5 font-serif text-2xl font-semibold">{formatMoveIn(listing.available_from)}</dd>
        </div>
      </dl>

      {listing.description ? (
        <p className="mt-5 line-clamp-3 text-sm leading-6 text-muted">{listing.description}</p>
      ) : null}
      <Link
        href={`/browse/${listing.id}`}
        className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.16em] text-accent"
      >
        Full listing →
      </Link>
    </div>
  );
}

/* ---------- page 2: amenities, property, house rules ---------- */
function Home({ entry }: { entry: DeckEntry }) {
  const { listing } = entry;
  const amenities = FEATURES.filter((f) => listing[f.key]);
  const propertyIcon: DetailIconName =
    listing.property_type === "private_house" || listing.property_type === "garden_apartment" ? "home" : "building";

  return (
    <div className="space-y-5">
      <Group title="Amenities">
        {amenities.length === 0 ? (
          <span className="text-sm text-muted">No extras listed</span>
        ) : (
          amenities.map((f) => (
            <Item key={f.key} icon={AMENITY_ICONS[f.key] ?? "building"}>
              {f.label}
            </Item>
          ))
        )}
      </Group>
      <Group title="Property">
        <Item icon={propertyIcon}>{propertyTypeLabel(listing.property_type)}</Item>
        <Item icon="door">
          {listing.rooms} room{listing.rooms === 1 ? "" : "s"}
        </Item>
        {listing.size_sqm ? <Item icon="ruler">{listing.size_sqm} m²</Item> : null}
      </Group>
      <Group title="House rules">
        <Item icon="users">
          {listing.roommates_count} flatmate{listing.roommates_count === 1 ? "" : "s"}
        </Item>
        <Item icon="paw">{listing.pets_allowed ? "Pets welcome" : "No pets"}</Item>
        <Item icon={listing.smoking_allowed ? "smoking" : "no-smoking"}>
          {listing.smoking_allowed ? "Smoking OK" : "No smoking"}
        </Item>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={eyebrow}>{title}</p>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">{children}</div>
    </div>
  );
}

function Item({ icon, children }: { icon: DetailIconName; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <DetailIcon name={icon} />
      {children}
    </span>
  );
}

/* ---------- page 3: current flatmates ---------- */
function Flatmates({ entry, seeker }: { entry: DeckEntry; seeker: Profile }) {
  const people = [entry.owner, ...entry.residents];
  return (
    <ul className="space-y-5">
      {people.map((p, i) => {
        const shared = sharedInterests(seeker, p).slice(0, 4);
        const others = shared.length === 0 ? p.interests.slice(0, 3) : [];
        return (
          <li key={p.user_id} className="flex gap-4">
            <Avatar url={p.avatar_url} name={p.full_name} size={14} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="font-medium">
                  {p.full_name}, {p.age}
                </p>
                <span className={eyebrow}>{i === 0 ? "Host" : "Flatmate"}</span>
              </div>
              {p.occupation ? <p className="mt-0.5 text-sm text-muted">{p.occupation}</p> : null}
              {p.bio ? <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted">{p.bio}</p> : null}
              {shared.length > 0 || others.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {shared.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent"
                    >
                      {s}
                    </span>
                  ))}
                  {others.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-hairline px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted"
                    >
                      {s}
                    </span>
                  ))}
                  {shared.length > 0 ? (
                    <span className="self-center text-[10px] uppercase tracking-wider text-muted">in common</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

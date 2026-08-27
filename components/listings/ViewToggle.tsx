"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ListingView } from "@/lib/validation/filters";

/**
 * List ↔ Map on the Listings page. Writes `?view=` so the choice survives a
 * reload, a shared link and the back button, and keeps every other filter.
 * Sits on the results line beside the sort pill.
 */
export function ViewToggle({ value }: { value: ListingView }) {
  const router = useRouter();
  const params = useSearchParams();

  function choose(view: ListingView) {
    if (view === value) return;
    const next = new URLSearchParams(params.toString());
    if (view === "list") next.delete("view");
    else next.set("view", view);
    next.delete("page"); // page numbers mean nothing on the map
    const qs = next.toString();
    router.push(qs ? `/browse?${qs}` : "/browse");
  }

  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex shrink-0 items-center rounded-full border border-hairline bg-surface p-0.5"
    >
      <Option current={value} value="list" onPick={choose} label="List" icon={<ListIcon />} />
      <Option current={value} value="map" onPick={choose} label="Map" icon={<MapIcon />} />
    </div>
  );
}

function Option({
  current,
  value,
  label,
  icon,
  onPick,
}: {
  current: ListingView;
  value: ListingView;
  label: string;
  icon: React.ReactNode;
  onPick: (v: ListingView) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] leading-none transition-colors ${
        active ? "bg-accent font-semibold text-accent-contrast" : "text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Z" />
      <path d="M9 4v13M15 7v13" />
    </svg>
  );
}

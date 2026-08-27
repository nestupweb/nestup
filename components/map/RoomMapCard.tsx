"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/geo";

/**
 * Leaflet reaches for `window` as it loads, so the map is pulled in only in the
 * browser. Everything below the fold of a listing page still renders on the
 * server; this card fills in a moment later.
 */
const RoomMap = dynamic(() => import("@/components/map/RoomMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-2xl border border-hairline bg-surface" />
  ),
});

export function RoomMapCard({
  point,
  exact,
  label,
  note,
}: {
  point: LatLng;
  exact: boolean;
  label: string;
  /** One line under the map — why the position is approximate, or the address. */
  note?: string;
}) {
  return (
    <div>
      <div className="h-64 sm:h-80">
        <RoomMap point={point} exact={exact} label={label} className="h-full w-full" />
      </div>
      {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { ListingPin } from "@/lib/listings";

const ListingsMap = dynamic(() => import("@/components/map/ListingsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-2xl border border-hairline bg-surface" />
  ),
});

/**
 * The map half of the Listings page. Sized to fill the screen below the
 * header, so the map reads as the view rather than as a widget inside a list.
 */
export function ResultsMap({ pins, unplaced }: { pins: ListingPin[]; unplaced: number }) {
  return (
    <div className="mt-4">
      <div className="h-[62vh] min-h-[420px] overflow-hidden rounded-2xl border border-hairline lg:h-[calc(100dvh-13rem)]">
        <ListingsMap pins={pins} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {pins.length} room{pins.length === 1 ? "" : "s"} on the map
        {unplaced > 0
          ? ` · ${unplaced} more ${unplaced === 1 ? "has" : "have"} no location yet and only ${
              unplaced === 1 ? "appears" : "appear"
            } in the list`
          : ""}
        . Pins show the neighbourhood, not the exact address.
      </p>
    </div>
  );
}

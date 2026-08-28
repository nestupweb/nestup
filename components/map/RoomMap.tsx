"use client";

import { useEffect, useState } from "react";
import { Map, MapControls, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { MAP_STYLES, MAX_ZOOM, ROOM_ZOOM } from "@/components/map/basemap";
import { useIsTouch, useMapTheme } from "@/components/map/useMapTheme";
import type { LatLng } from "@/lib/geo";

/**
 * Where the room is — a pin on the address.
 *
 * It used to be a 150 m circle for anyone who wasn't already talking to the
 * household, on the grounds that a public listing shouldn't publish a
 * stranger's front door. The user dropped that on 2026-08-28: this is a school
 * demo with invented rooms, and a map that won't say where the room is isn't
 * much of a map.
 *
 * On touch devices the map ignores the first touch (`activate` overlay) so a
 * scroll down the page doesn't turn into a pan halfway through.
 */
export default function RoomMap({
  point,
  label,
  className = "",
}: {
  point: LatLng;
  /** Read out to screen readers — the street and city the pin sits on. */
  label: string;
  className?: string;
}) {
  const theme = useMapTheme();
  const [active, setActive] = useState(false);
  const touch = useIsTouch();
  const interactive = !touch || active;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-hairline ${className}`}>
      <Map
        theme={theme}
        styles={MAP_STYLES}
        center={[point.lng, point.lat]}
        zoom={ROOM_ZOOM}
        maxZoom={MAX_ZOOM}
        scrollZoom={false}
        className="h-full w-full"
        aria-label={`Map showing ${label}`}
      >
        <Interactivity enabled={interactive} />
        <MapControls position="bottom-right" showZoom />
        <MapMarker longitude={point.lng} latitude={point.lat}>
          <MarkerContent>
            <RoomPin label={label} />
          </MarkerContent>
        </MapMarker>
      </Map>

      {touch && !active ? (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="absolute inset-0 z-[400] flex items-end justify-center bg-transparent pb-4"
          aria-label="Activate map"
        >
          <span className="rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
            Tap to move the map
          </span>
        </button>
      ) : null}
    </div>
  );
}

/** A teardrop in the app's accent, so the room stands out from the map's own pins. */
function RoomPin({ label }: { label: string }) {
  return (
    <span title={label} className="block h-8 w-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]">
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <path
          d="M12 2c-3.9 0-7 3.1-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z"
          fill="var(--accent)"
          stroke="var(--accent-contrast)"
          strokeWidth="1.6"
        />
        <circle cx="12" cy="9" r="2.6" fill="var(--accent-contrast)" />
      </svg>
    </span>
  );
}

/**
 * Panning and pinch-zoom, switched at runtime.
 *
 * MapLibre reads its handler options once, when the map is built, so the
 * "tap to activate" overlay can't work by re-rendering with different props —
 * the handlers have to be turned on the instance itself.
 */
function Interactivity({ enabled }: { enabled: boolean }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    for (const handler of [map.dragPan, map.touchZoomRotate, map.doubleClickZoom]) {
      if (enabled) handler.enable();
      else handler.disable();
    }
  }, [map, enabled]);
  return null;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Map, MapControls, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { MAP_STYLES, MAX_ZOOM, ROOM_ZOOM } from "@/components/map/basemap";
import { useMapTheme } from "@/components/map/useMapTheme";
import { CITY_CENTRES, ISRAEL_CENTRE } from "@/lib/city-centres";
import type { LatLng } from "@/lib/geo";

/**
 * "Is this the right spot?" — the owner's own pin.
 *
 * Address lookup gets a building wrong often enough that the honest fix is to
 * let the person who lives there drag the marker. Doing so submits
 * `pin_moved=1` with the coordinates, and the save path then treats that point
 * as final: no later automatic lookup overwrites it.
 */
export default function PinPicker({
  initial,
  city,
  onMove,
}: {
  initial: LatLng | null;
  /** Falls back to this city's centre when the listing has no point yet. */
  city: string;
  onMove: (point: LatLng) => void;
}) {
  const theme = useMapTheme();
  const start = useMemo(() => initial ?? CITY_CENTRES[city] ?? ISRAEL_CENTRE, [initial, city]);
  const [point, setPoint] = useState<LatLng>(start);

  const move = useCallback(
    (next: LatLng) => {
      const rounded = { lat: Math.round(next.lat * 1e6) / 1e6, lng: Math.round(next.lng * 1e6) / 1e6 };
      setPoint(rounded);
      onMove(rounded);
    },
    [onMove]
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline">
      <Map
        theme={theme}
        styles={MAP_STYLES}
        center={[start.lng, start.lat]}
        zoom={initial ? ROOM_ZOOM + 1 : 12}
        maxZoom={MAX_ZOOM}
        scrollZoom={false}
        className="h-56 w-full sm:h-64"
        aria-label="Drag the pin to the exact spot"
      >
        <MapControls position="bottom-right" showZoom />
        <ClickToPlace onPick={move} />
        <MapMarker
          longitude={point.lng}
          latitude={point.lat}
          draggable
          onDragEnd={(lngLat) => move({ lat: lngLat.lat, lng: lngLat.lng })}
        >
          <MarkerContent>
            <span className="block h-3.5 w-3.5 rounded-full border-2 border-accent-contrast bg-accent shadow-[0_1px_4px_rgba(0,0,0,0.4)]" />
          </MarkerContent>
        </MapMarker>
      </Map>
    </div>
  );
}

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const handler = (e: { lngLat: { lat: number; lng: number } }) =>
      onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onPick]);
  return null;
}

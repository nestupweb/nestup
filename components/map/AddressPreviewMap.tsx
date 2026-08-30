"use client";

import { useEffect, useRef } from "react";
import { Map, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { MAP_STYLES, MAX_ZOOM, ROOM_ZOOM } from "@/components/map/basemap";
import { useMapTheme } from "@/components/map/useMapTheme";
import type { LatLng } from "@/lib/geo";

/**
 * Read-only preview of where the address resolves to — no drag, no tap to
 * place. The owner used to be able to drag this pin to correct a lookup that
 * came out wrong; that also meant a stray drag could quietly move a real room
 * to the wrong building. The only way onto the map now is a verified geocode
 * (user decision, 2026-08-30), so the pin here is a preview of that, not
 * something to edit.
 */
export default function AddressPreviewMap({ point }: { point: LatLng }) {
  const theme = useMapTheme();

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline">
      <Map
        theme={theme}
        styles={MAP_STYLES}
        center={[point.lng, point.lat]}
        zoom={ROOM_ZOOM + 1}
        maxZoom={MAX_ZOOM}
        scrollZoom={false}
        className="h-56 w-full sm:h-64"
        aria-label="Map showing where the room will be listed"
      >
        <FollowPoint point={point} />
        <MapMarker longitude={point.lng} latitude={point.lat}>
          <MarkerContent>
            <span className="block h-3.5 w-3.5 rounded-full border-2 border-accent-contrast bg-accent shadow-[0_1px_4px_rgba(0,0,0,0.4)]" />
          </MarkerContent>
        </MapMarker>
      </Map>
    </div>
  );
}

/** Pans to a new preview point as the address is re-typed. Skips the point the map already opened on — `center` placed that one. */
function FollowPoint({ point }: { point: LatLng }) {
  const { map } = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (!map) return;
    if (first.current) {
      first.current = false;
      return;
    }
    map.flyTo({ center: [point.lng, point.lat], zoom: ROOM_ZOOM + 1, duration: 600 });
  }, [map, point.lat, point.lng]);
  return null;
}

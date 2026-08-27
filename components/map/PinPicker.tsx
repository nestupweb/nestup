"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { ATTRIBUTION, MAX_ZOOM, ROOM_ZOOM, TILES } from "@/components/map/basemap";
import { useMapTheme } from "@/components/map/useMapTheme";
import { pinIcon } from "@/components/map/pin";
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
  const start = useMemo(
    () => initial ?? CITY_CENTRES[city] ?? ISRAEL_CENTRE,
    [initial, city]
  );
  const [point, setPoint] = useState<LatLng>(start);
  const marker = useRef<LeafletMarker | null>(null);

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
      <MapContainer
        center={[start.lat, start.lng]}
        zoom={initial ? ROOM_ZOOM + 1 : 12}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom={false}
        className="h-56 w-full sm:h-64"
        aria-label="Drag the pin to the exact spot"
      >
        <ThemedTiles />
        <ClickToPlace onPick={move} />
        <Marker
          position={[point.lat, point.lng]}
          icon={pinIcon()}
          draggable
          ref={marker}
          eventHandlers={{
            dragend: () => {
              const p = marker.current?.getLatLng();
              if (p) move({ lat: p.lat, lng: p.lng });
            },
          }}
        />
      </MapContainer>
    </div>
  );
}

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

function ThemedTiles() {
  const map = useMap();
  const theme = useMapTheme();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [map]);
  return <TileLayer key={theme} url={TILES[theme]} attribution={ATTRIBUTION} maxZoom={MAX_ZOOM} />;
}

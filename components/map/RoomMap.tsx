"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { ATTRIBUTION, MAX_ZOOM, ROOM_ZOOM, TILES } from "@/components/map/basemap";
import { useIsTouch, useMapTheme } from "@/components/map/useMapTheme";
import { pinIcon } from "@/components/map/pin";
import { APPROX_RADIUS_M, type LatLng } from "@/lib/geo";

/**
 * Where one room is. Two modes:
 *  - approximate (the public default) — a soft circle over the neighbourhood,
 *    no marker on a building, because publishing a stranger's front door to
 *    anyone browsing is not ours to do;
 *  - exact — a pin, once the viewer is the owner, lives there, or is already
 *    in a conversation about the room.
 *
 * On touch devices the map ignores the first touch (`activate` overlay) so a
 * scroll down the page doesn't turn into a pan halfway through.
 */
export default function RoomMap({
  point,
  exact,
  label,
  className = "",
}: {
  point: LatLng;
  exact: boolean;
  /** Read out to screen readers — street or city, whatever the viewer may see. */
  label: string;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const touch = useIsTouch();
  const interactive = !touch || active;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-hairline ${className}`}>
      <MapContainer
        center={[point.lat, point.lng]}
        zoom={ROOM_ZOOM}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom={false}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        zoomControl
        attributionControl
        className="h-full w-full"
        style={{ background: "transparent" }}
        aria-label={`Map showing ${label}`}
      >
        <ThemedTiles />
        {exact ? (
          <Marker position={[point.lat, point.lng]} icon={pinIcon()} title={label} />
        ) : (
          <Circle
            center={[point.lat, point.lng]}
            radius={APPROX_RADIUS_M}
            pathOptions={{
              color: "var(--accent)",
              fillColor: "var(--accent)",
              fillOpacity: 0.18,
              weight: 2,
              opacity: 0.7,
            }}
          />
        )}
      </MapContainer>

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

/** Swaps the tile set when the app's theme changes, without remounting the map. */
function ThemedTiles() {
  const map = useMap();
  const theme = useMapTheme();

  // Leaflet sizes itself against the container; a card that mounts hidden
  // (inside a tab, say) measures 0×0 until told to look again.
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [map]);

  return <TileLayer key={theme} url={TILES[theme]} attribution={ATTRIBUTION} maxZoom={MAX_ZOOM} />;
}

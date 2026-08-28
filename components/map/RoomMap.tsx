"use client";

import { Map, MapControls, MapMarker, MarkerContent, MarkerTooltip } from "@/components/ui/map";
import { MAP_STYLES, MAX_ZOOM, PLACES, ROOM_ZOOM } from "@/components/map/basemap";
import { useMapTheme } from "@/components/map/useMapTheme";
import type { LatLng } from "@/lib/geo";
import type { Place } from "@/lib/places";

/**
 * One room's map: the room itself, and what's around it.
 *
 * The room's pin is the app's accent, teardrop-shaped and twice the size of
 * anything else, and it is drawn last so it sits over the rest — the user
 * asked for the room to be one colour and everything else another, and this is
 * the half of that they see first. The places around it are the four colours
 * in `PLACES`, small and round, named on hover.
 *
 * The pin is at the room's own stored coordinates, exactly. There is no
 * blurring, no circle and no offset (user decision, 2026-08-28): a room we
 * can't place gets no map at all rather than a pin that's nearly right.
 */
export default function RoomMap({
  point,
  label,
  places,
}: {
  point: LatLng;
  /** Read out to screen readers — the street and city the pin sits on. */
  label: string;
  places: Place[];
}) {
  const theme = useMapTheme();

  return (
    <Map
      theme={theme}
      styles={MAP_STYLES}
      center={[point.lng, point.lat]}
      zoom={ROOM_ZOOM}
      maxZoom={MAX_ZOOM}
      className="h-full w-full"
      aria-label={`Map showing ${label}`}
    >
      <MapControls position="bottom-right" showZoom />

      {places.map((place) => (
        <MapMarker key={place.id} longitude={place.lng} latitude={place.lat}>
          <MarkerContent>
            <PlaceDot color={PLACES[place.kind].color} />
          </MarkerContent>
          <MarkerTooltip>{place.name}</MarkerTooltip>
        </MapMarker>
      ))}

      {/* Last, and with a class the stylesheet lifts above the place pins:
          MapLibre stacks markers by latitude, so the room would otherwise
          disappear behind anything mapped north of it. */}
      <MapMarker longitude={point.lng} latitude={point.lat} className="room-pin">
        <MarkerContent>
          <RoomPin label={label} />
        </MarkerContent>
      </MapMarker>
    </Map>
  );
}

/** A café, a bar, a shop — small enough that a street of them still reads. */
function PlaceDot({ color }: { color: string }) {
  return (
    <span
      className="block h-[11px] w-[11px] rounded-full border-2 border-surface shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
      style={{ backgroundColor: color }}
    />
  );
}

/** The room: a teardrop in the app's accent, larger than everything else. */
function RoomPin({ label }: { label: string }) {
  return (
    <span title={label} className="block h-9 w-9 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]">
      <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
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

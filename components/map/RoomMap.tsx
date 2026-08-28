"use client";

import { useCallback, useMemo, useState } from "react";
import { Map, MapControls, MapMarker, MapPopup, MarkerContent, MarkerTooltip } from "@/components/ui/map";
import { MAP_STYLES, MAX_ZOOM, NEARBY_ROOM_COLOR, PLACES, ROOM_ZOOM } from "@/components/map/basemap";
import { PinCard } from "@/components/map/PinCard";
import { RoomPinsLayer } from "@/components/map/RoomPinsLayer";
import { useMapTheme } from "@/components/map/useMapTheme";
import { boundsOf, distanceM, type LatLng } from "@/lib/geo";
import type { ListingPin } from "@/lib/listings";
import type { Place } from "@/lib/places";

/**
 * One room's map: the room itself, what's around it, and what else is going.
 *
 * The room's pin is the app's accent, teardrop-shaped and twice the size of
 * anything else, and it is drawn last so it sits over the rest — the user
 * asked for the room to be one colour and everything else another, and this is
 * the half of that they see first. The places around it are the four colours
 * in `PLACES`, small and round, named on hover.
 *
 * The other rooms nearby are red teardrops, drawn by the same layer that draws
 * the map of every room, so they thin out and fill back in with the zoom
 * exactly as they do there, and clicking one opens the same card (user
 * request, 2026-08-28: compare this room against its alternatives without
 * leaving it). They're a GL layer, which is also why they sit under the room's
 * own pin and under the place dots — those are DOM markers, always on top.
 *
 * Every pin is at its room's own stored coordinates, exactly. There is no
 * blurring, no circle and no offset (user decision, 2026-08-28): a room we
 * can't place gets no pin rather than one that's nearly right.
 */

/**
 * How many alternatives the opening view tries to include, and how far out it
 * will go to find them.
 *
 * The map used to open at street zoom flat, which showed the cafés beautifully
 * and — in a city where our rooms are a few hundred metres apart — not one red
 * pin, so the comparison the map is for wasn't on screen until you zoomed out.
 * It now opens on the room and its nearest few instead.
 *
 * Kept deliberately tight: framing the nearest few wherever they were pulled
 * the view out to a couple of neighbourhoods, and at that distance the places
 * around the room collapse into one unreadable clump. Nine hundred metres is
 * where the two wants meet — 88% of our rooms have another one that close, and
 * the cafés still read at that zoom. A room with nothing that close opens at
 * street zoom exactly as before: the alternatives are still on the map, a
 * zoom-out away, which is the truthful answer to "what else is around here".
 */
const FRAME_ROOMS = 4;
const FRAME_RADIUS_M = 900;

/**
 * Slack around that box, in degrees — about 55 m.
 *
 * Small on purpose. The dialog's map is wide and short, so the height is what
 * decides the zoom, and padding counts twice there: a tenth of a degree of
 * generosity here cost two zoom levels and the whole point of the framing.
 * `fitBoundsOptions` adds the pixels that keep a pin off the edge.
 */
const FRAME_PAD_DEG = 0.0005;
export default function RoomMap({
  point,
  label,
  places,
  nearby,
}: {
  point: LatLng;
  /** Read out to screen readers — the street and city the pin sits on. */
  label: string;
  places: Place[];
  /** Other rooms within a few kilometres. Never includes this one. */
  nearby: ListingPin[];
}) {
  const theme = useMapTheme();
  const [chosen, setChosen] = useState<ListingPin | null>(null);
  const choose = useCallback((pin: ListingPin) => setChosen(pin), []);

  // The room plus its nearest handful, so at least a few alternatives are on
  // screen the moment the map opens.
  const box = useMemo(() => {
    const close = nearby
      .map((pin) => ({ pin, away: distanceM(point, pin) }))
      .filter(({ away }) => away <= FRAME_RADIUS_M)
      .sort((a, b) => a.away - b.away)
      .slice(0, FRAME_ROOMS)
      .map(({ pin }) => pin);
    return close.length ? boundsOf([point, ...close], FRAME_PAD_DEG) : null;
  }, [nearby, point]);

  return (
    <Map
      theme={theme}
      styles={MAP_STYLES}
      center={[point.lng, point.lat]}
      zoom={ROOM_ZOOM}
      maxZoom={MAX_ZOOM}
      {...(box
        ? {
            bounds: [
              [box.west, box.south],
              [box.east, box.north],
            ] as [[number, number], [number, number]],
            // Never closer than street level: past that the room fills the
            // frame and the places around it fall off the edges.
            fitBoundsOptions: { padding: 40, maxZoom: ROOM_ZOOM },
          }
        : {})}
      className="h-full w-full"
      aria-label={`Map showing ${label}`}
    >
      <MapControls position="bottom-right" showZoom />

      {/* Bigger than on the map of the whole country: there are a few dozen
          here rather than eight hundred, and they have to be worth aiming at. */}
      <RoomPinsLayer
        pins={nearby}
        theme={theme}
        onSelect={choose}
        fill={NEARBY_ROOM_COLOR}
        size={0.75}
        name="nearby"
      />

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

      {chosen ? (
        <MapPopup
          longitude={chosen.lng}
          latitude={chosen.lat}
          onClose={() => setChosen(null)}
          closeButton
          offset={12}
          className="w-[13.5rem]"
        >
          <PinCard listing={chosen} />
        </MapPopup>
      ) : null}
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

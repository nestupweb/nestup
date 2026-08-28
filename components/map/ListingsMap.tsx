"use client";

import { useCallback, useMemo, useState } from "react";
import { Map, MapControls, MapPopup } from "@/components/ui/map";
import { COUNTRY_ZOOM, MAP_STYLES, MAX_ZOOM } from "@/components/map/basemap";
import { PinCard } from "@/components/map/PinCard";
import { RoomPinsLayer } from "@/components/map/RoomPinsLayer";
import { useMapTheme } from "@/components/map/useMapTheme";
import { ISRAEL_CENTRE } from "@/lib/city-centres";
import { boundsOf } from "@/lib/geo";
import type { ListingPin } from "@/lib/listings";

/**
 * Every room on NestUp, on one map.
 *
 * The pins are the same accent teardrop a room's own map draws, in one GL
 * symbol layer — see `components/map/RoomPinsLayer.tsx` for why they thin out
 * when you zoom away and fill in as you zoom back. Clicking one opens a card
 * with a way through to the room.
 */
export default function ListingsMap({ pins }: { pins: ListingPin[] }) {
  const theme = useMapTheme();
  const [chosen, setChosen] = useState<ListingPin | null>(null);
  const choose = useCallback((pin: ListingPin) => setChosen(pin), []);

  // Opening on the rooms themselves rather than a fixed view of the country:
  // the panel is a different shape on a phone and on a laptop, and fitting the
  // bounds is the only thing that looks right on both.
  const box = useMemo(() => boundsOf(pins, 0.05), [pins]);

  return (
    <Map
      theme={theme}
      styles={MAP_STYLES}
      center={[ISRAEL_CENTRE.lng, ISRAEL_CENTRE.lat]}
      zoom={COUNTRY_ZOOM}
      maxZoom={MAX_ZOOM}
      {...(box
        ? {
            bounds: [
              [box.west, box.south],
              [box.east, box.north],
            ] as [[number, number], [number, number]],
            fitBoundsOptions: { padding: 16 },
          }
        : {})}
      className="h-full w-full"
      aria-label={`Map of ${pins.length} room${pins.length === 1 ? "" : "s"}`}
    >
      <MapControls position="bottom-right" showZoom showLocate />

      <RoomPinsLayer pins={pins} theme={theme} onSelect={choose} />

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

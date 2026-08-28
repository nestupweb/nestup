"use client";

import { useEffect, useMemo, useState } from "react";
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { MAP_COLORS, MAP_STYLES, MAX_ZOOM, ROOM_ZOOM } from "@/components/map/basemap";
import { useIsTouch, useMapTheme } from "@/components/map/useMapTheme";
import { APPROX_RADIUS_M, circlePolygon, type LatLng } from "@/lib/geo";

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
  const theme = useMapTheme();
  const colors = MAP_COLORS[theme];
  const [active, setActive] = useState(false);
  const touch = useIsTouch();
  const interactive = !touch || active;

  const area = useMemo(() => circlePolygon(point, APPROX_RADIUS_M), [point]);

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
        {exact ? (
          <MapMarker longitude={point.lng} latitude={point.lat}>
            <MarkerContent>
              <span
                title={label}
                className="block h-3.5 w-3.5 rounded-full border-2 border-accent-contrast bg-accent shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
              />
            </MarkerContent>
          </MapMarker>
        ) : (
          <MapGeoJSON
            data={area}
            fillPaint={{ "fill-color": colors.accent, "fill-opacity": 0.18 }}
            linePaint={{ "line-color": colors.accent, "line-width": 2, "line-opacity": 0.7 }}
          />
        )}
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

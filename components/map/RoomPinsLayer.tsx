"use client";

import { useEffect } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { useMap } from "@/components/ui/map";
import { MAP_COLORS } from "@/components/map/basemap";
import type { ListingPin } from "@/lib/listings";

/**
 * Every room on one map, as pins.
 *
 * This replaced clustering on 2026-08-28. Clusters drew big accent circles
 * with a room count in them, which the user read — reasonably — as "what are
 * these blobs?": the map of all rooms looked nothing like the map of one room.
 * Now both draw the same accent teardrop.
 *
 * Eight hundred pins can't all be legible at country zoom, and the fix is
 * MapLibre's own: `icon-allow-overlap: false` means a pin that would land on
 * top of one already drawn is simply not drawn. So zoomed out you get a
 * readable scatter, and every zoom step reveals more of them, down to all of
 * them at street level. There is no threshold to tune, and no count to explain.
 *
 * One GL symbol layer rather than 800 DOM markers, which is what makes it
 * quick — the same reason the cluster layer was used before.
 */

const SOURCE = "nestup-rooms";
const LAYER = "nestup-room-pins";
const ICON = "nestup-room-pin";

/** The teardrop from a room's own map, drawn for the GL renderer. */
function pinSvg(fill: string, ink: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24">
<path d="M12 2c-3.9 0-7 3.1-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z" fill="${fill}" stroke="${ink}" stroke-width="1.6"/>
<circle cx="12" cy="9" r="2.6" fill="${ink}"/>
</svg>`;
}

function loadPin(fill: string, ink: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(fill, ink))}`;
  });
}

export function RoomPinsLayer({
  pins,
  theme,
  onSelect,
}: {
  pins: ListingPin[];
  /** Redraws the icon when the theme flips — the accent changes with it. */
  theme: "light" | "dark";
  onSelect: (pin: ListingPin) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    let cancelled = false;

    const data = {
      type: "FeatureCollection" as const,
      features: pins.map((pin) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [pin.lng, pin.lat] },
        properties: pin,
      })),
    };

    const draw = async () => {
      const colors = MAP_COLORS[theme];
      const image = await loadPin(colors.accent, colors.on);
      // The style can be swapped (theme change) while the image decodes, and
      // adding a layer to a style that is on its way out throws.
      if (cancelled || !map.isStyleLoaded()) return;

      if (map.hasImage(ICON)) map.removeImage(ICON);
      map.addImage(ICON, image, { pixelRatio: 3 });

      if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: "geojson", data });
      else (map.getSource(SOURCE) as GeoJSONSource).setData(data);

      if (!map.getLayer(LAYER)) {
        map.addLayer({
          id: LAYER,
          type: "symbol",
          source: SOURCE,
          layout: {
            "icon-image": ICON,
            "icon-size": 0.42,
            // Anchored at the point of the teardrop, so the pin marks the
            // address rather than hovering above it.
            "icon-anchor": "bottom",
            // The whole trick: overlapping pins are dropped, so zooming in is
            // what reveals more of them.
            "icon-allow-overlap": false,
            "icon-ignore-placement": false,
            "icon-padding": 2,
          },
        });
      }
    };

    void draw();

    // A theme change rebuilds the style from scratch, taking every source and
    // layer with it, so everything above has to happen again afterwards.
    const redraw = () => void draw();
    map.on("style.load", redraw);

    const open = (e: { features?: { properties?: unknown }[] }) => {
      const hit = e.features?.[0]?.properties as ListingPin | undefined;
      if (hit) onSelect(hit);
    };
    const enter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const leave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", LAYER, open);
    map.on("mouseenter", LAYER, enter);
    map.on("mouseleave", LAYER, leave);

    return () => {
      cancelled = true;
      map.off("style.load", redraw);
      map.off("click", LAYER, open);
      map.off("mouseenter", LAYER, enter);
      map.off("mouseleave", LAYER, leave);
      // The map itself is torn down with the dialog; only guard against a
      // style that is still around.
      if (!map.getStyle()) return;
      if (map.getLayer(LAYER)) map.removeLayer(LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  }, [map, isLoaded, pins, theme, onSelect]);

  return null;
}

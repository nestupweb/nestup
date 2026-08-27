"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { ATTRIBUTION, COUNTRY_ZOOM, DARK_TILE_CLASS, MAX_ZOOM, TILES } from "@/components/map/basemap";
import { clusterIcon, priceIcon } from "@/components/map/pin";
import { useMapTheme } from "@/components/map/useMapTheme";
import { ISRAEL_CENTRE } from "@/lib/city-centres";
import { clusterPoints, zoomIntoCluster } from "@/lib/cluster";
import { boundsOf } from "@/lib/geo";
import type { ListingPin } from "@/lib/listings";

/**
 * Every room matching the current filters, on one map.
 *
 * Pins that sit on top of each other at the current zoom collapse into a
 * numbered circle (see `lib/cluster.ts`); clicking one zooms in until it comes
 * apart. A lone pin shows its rent, and clicking it opens a small card with a
 * way through to the room.
 *
 * Panning deliberately does NOT re-filter: the sidebar decides what is on the
 * map, so moving around can never quietly drop rooms the member asked for.
 */
export default function ListingsMap({ pins }: { pins: ListingPin[] }) {
  const bounds = useMemo(() => boundsOf(pins, 0.02), [pins]);

  return (
    <MapContainer
      center={[ISRAEL_CENTRE.lat, ISRAEL_CENTRE.lng]}
      zoom={COUNTRY_ZOOM}
      maxZoom={MAX_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
      aria-label={`Map of ${pins.length} room${pins.length === 1 ? "" : "s"}`}
    >
      <ThemedTiles />
      {/* Pins first, on purpose: its zoom listener has to be attached before
          FitTo runs, or the zoom change that fitBounds makes is missed and
          every room stays welded into one country-sized cluster. */}
      <Pins pins={pins} />
      {bounds ? <FitTo bounds={bounds} /> : null}
    </MapContainer>
  );
}

/** Opens on the rooms themselves rather than a fixed view of the country. */
function FitTo({ bounds }: { bounds: { south: number; west: number; north: number; east: number } }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ],
      { padding: [28, 28], maxZoom: 15 }
    );
  }, [map, bounds]);
  return null;
}

function Pins({ pins }: { pins: ListingPin[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  // `moveend` as well as `zoomend`: fitBounds can land on a new zoom without a
  // separate zoom event, and a stale zoom here means stale clusters.
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => setZoom(map.getZoom()),
  });

  const clusters = useMemo(() => clusterPoints(pins, zoom), [pins, zoom]);

  return (
    <>
      {clusters.map((c) =>
        c.items.length === 1 ? (
          <Marker
            key={c.key}
            position={[c.lat, c.lng]}
            icon={priceIcon(`₪${c.items[0].rent.toLocaleString()}`)}
            title={c.items[0].title}
          >
            <Popup minWidth={200} maxWidth={240}>
              <PinCard listing={c.items[0]} />
            </Popup>
          </Marker>
        ) : (
          <Marker
            key={c.key}
            position={[c.lat, c.lng]}
            icon={clusterIcon(c.items.length)}
            title={`${c.items.length} rooms`}
            eventHandlers={{
              click: () => map.setView([c.lat, c.lng], zoomIntoCluster(map.getZoom(), MAX_ZOOM)),
            }}
          />
        )
      )}
    </>
  );
}

/** The little card behind a pin. */
function PinCard({ listing }: { listing: ListingPin }) {
  return (
    <Link href={`/browse/${listing.id}`} className="block w-[200px] overflow-hidden rounded-xl no-underline">
      {listing.photo ? (
        // Plain <img>: this markup is injected into Leaflet's popup, outside
        // Next's layout pass, so next/image's sizing would fight it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.photo} alt="" className="h-24 w-full object-cover" loading="lazy" />
      ) : null}
      <span className="block px-3 py-2">
        <span className="block text-sm font-bold text-ink">₪{listing.rent.toLocaleString()}<span className="font-normal text-muted"> /mo</span></span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {listing.city}
          {listing.neighborhood ? ` · ${listing.neighborhood}` : ""}
        </span>
      </span>
    </Link>
  );
}

function ThemedTiles() {
  const theme = useMapTheme();
  return (
    <TileLayer
      key={theme}
      url={TILES[theme]}
      attribution={ATTRIBUTION}
      maxZoom={MAX_ZOOM}
      className={theme === "dark" ? DARK_TILE_CLASS : undefined}
    />
  );
}

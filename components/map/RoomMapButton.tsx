"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { NEARBY_ROOM_COLOR, PLACES, type PlaceKind } from "@/components/map/basemap";
import { MapDialog, MapIconButton, MapSkeleton } from "@/components/map/MapPanel";
import type { LatLng } from "@/lib/geo";
import type { ListingPin } from "@/lib/listings";
import type { Place } from "@/lib/places";

const RoomMap = dynamic(() => import("@/components/map/RoomMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

/**
 * "Where it is" on a room's page: the address in words, and a map icon.
 *
 * The map used to be drawn straight into the page. It isn't any more (user
 * decision, 2026-08-28) — nothing map-shaped appears until the icon is
 * pressed, here exactly as on Listings.
 *
 * What's around the room is fetched on that first press, not with the page:
 * it's an Overpass lookup, and most visitors never open the map. If it comes
 * back empty — a busy mirror, or genuinely nothing within a few minutes' walk
 * — the map still opens with the room on it.
 *
 * The rooms nearby come the other way, with the page: that's our own database
 * and one boxed query, so there's nothing to wait for and no second failure
 * mode to design around.
 */
export function RoomMapButton({
  point,
  address,
  city,
  note,
  nearby,
}: {
  point: LatLng;
  /** The street line, as it's written on the listing. */
  address: string;
  city: string;
  /** The address as a sentence, from `lib/location.ts` — shown beside the icon. */
  note: string;
  /** Other rooms within a few kilometres, drawn in red. Never includes this one. */
  nearby: ListingPin[];
}) {
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const where = [address, city].filter(Boolean).join(", ");

  const load = useCallback(async () => {
    // `ok: false` means nobody answered, which is not the same as a street with
    // nothing on it — Overpass is a volunteer service and being busy is its
    // normal state. One retry turns most of those into an answer; after that
    // the map opens with just the room, which is still a working map.
    for (const wait of [0, 1500]) {
      if (wait) await new Promise((done) => setTimeout(done, wait));
      try {
        const res = await fetch(`/api/places?lat=${point.lat}&lng=${point.lng}`);
        const body = (await res.json()) as { places?: Place[]; ok?: boolean };
        if (body.ok !== false) {
          setPlaces(body.places ?? []);
          return;
        }
      } catch {
        /* offline or aborted — try once more, then give up quietly */
      }
    }
    setPlaces([]); // the room's own pin is the part that matters
  }, [point.lat, point.lng]);

  function show() {
    setOpen(true);
    if (!places) void load();
  }

  const hide = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <MapIconButton onClick={show} open={open} label={`Open the map of ${where}`} buttonRef={trigger} />
      <p className="text-sm text-muted">
        {note}
        <span className="hidden sm:inline"> Open the map to see what&rsquo;s nearby.</span>
      </p>

      {open ? (
        <MapDialog
          title={address || city}
          subtitle={
            places === null
              ? "Looking around the street…"
              : places.length === 0
                ? city
                : `${city} · ${places.length} place${places.length === 1 ? "" : "s"} within a few minutes' walk`
          }
          footer={<Legend places={places ?? []} nearby={nearby.length} />}
          onClose={hide}
        >
          {places === null ? (
            <MapSkeleton />
          ) : (
            <RoomMap point={point} label={where} places={places} nearby={nearby} />
          )}
        </MapDialog>
      ) : null}
    </div>
  );
}

/**
 * What the colours mean.
 *
 * Only the kinds actually on the map are listed — a legend entry for bars in a
 * village with no bar teaches the reader nothing.
 */
function Legend({ places, nearby }: { places: Place[]; nearby: number }) {
  const present = (Object.keys(PLACES) as PlaceKind[]).filter((kind) =>
    places.some((place) => place.kind === kind)
  );

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
      <li className="flex items-center gap-1.5 font-medium text-ink">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
        This room
      </li>
      {nearby > 0 ? (
        <li className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: NEARBY_ROOM_COLOR }}
            aria-hidden="true"
          />
          {nearby} other room{nearby === 1 ? "" : "s"} nearby
        </li>
      ) : null}
      {present.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: PLACES[kind].color }}
            aria-hidden="true"
          />
          {PLACES[kind].label}
        </li>
      ))}
    </ul>
  );
}

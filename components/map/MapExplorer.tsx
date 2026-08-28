"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { MapDialog, MapIconButton, MapSkeleton } from "@/components/map/MapPanel";
import type { ListingPin } from "@/lib/listings";

const ListingsMap = dynamic(() => import("@/components/map/ListingsMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

/**
 * Every room on NestUp, behind the map icon on the Listings results line.
 *
 * What it shows is deliberately *everything*: every placed room, not the
 * current filter. Pins are fetched the first time the map is opened and kept
 * for the rest of the visit — eight hundred of them are about 150 KB, and most
 * visits never open the map at all.
 */
export function MapExplorer() {
  const [open, setOpen] = useState(false);
  const [pins, setPins] = useState<ListingPin[] | null>(null);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/listings/pins");
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { pins: ListingPin[] };
      setPins(body.pins);
    } catch {
      setFailed(true);
    }
  }, []);

  function show() {
    setOpen(true);
    if (!pins) void load();
  }

  const hide = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  return (
    <>
      <MapIconButton onClick={show} open={open} label="Open the map of every room" buttonRef={trigger} />

      {open ? (
        <MapDialog
          title="Every room on NestUp"
          subtitle={
            pins === null ? (
              "Gathering the pins…"
            ) : (
              <>
                {pins.length} room{pins.length === 1 ? "" : "s"} on the map
                {/* Worth a line of its own, but not four of them on a phone —
                    there it would push the map down. */}
                <span className="hidden sm:inline">{" · "}each one is pinned at its address</span>
              </>
            )
          }
          onClose={hide}
        >
          {failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted">The map couldn&rsquo;t load the rooms just now.</p>
              <button
                type="button"
                onClick={load}
                className="rounded-full border border-hairline px-4 py-1.5 text-sm font-medium text-accent transition-colors hover:border-accent"
              >
                Try again
              </button>
            </div>
          ) : pins === null ? (
            <MapSkeleton />
          ) : pins.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
              No rooms have a location yet.
            </div>
          ) : (
            <ListingsMap pins={pins} />
          )}
        </MapDialog>
      ) : null}
    </>
  );
}

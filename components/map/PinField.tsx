"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { LatLng } from "@/lib/geo";

const PinPicker = dynamic(() => import("@/components/map/PinPicker"), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-2xl border border-hairline bg-surface sm:h-64" />,
});

/**
 * The listing form's map row: a "place it yourself" pin that submits with the
 * rest of the form. Collapsed by default, and it only sends `pin_moved=1` once
 * the marker has actually been moved, so simply opening the map changes
 * nothing.
 *
 * Nothing here is ever required. Every save looks the address up and places
 * the room itself, and a save it cannot verify is refused outright rather than
 * handed to the owner as work (2026-08-29). This map is for the owner who
 * wants to correct a pin, or who knows an address Nominatim does not.
 */
export function PinField({
  initial,
  city,
  hasPoint,
}: {
  initial: LatLng | null;
  city: string;
  /** Whether the listing already has coordinates (affects the wording). */
  hasPoint: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(initial);
  const [moved, setMoved] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-semibold text-accent underline underline-offset-4"
          aria-expanded={open}
        >
          {open ? "Hide map" : hasPoint ? "Check the pin on the map" : "Place the room on the map"}
        </button>
        <span className="text-xs text-muted">
          {moved
            ? "Pin set — this is where the room will show."
            : hasPoint
              ? "We placed it from the address. Move it if it's off."
              : "Optional — we place it from the address when you save."}
        </span>
      </div>

      {open ? (
        <div className="mt-3">
          <PinPicker
            initial={point}
            city={city}
            onMove={(p) => {
              setPoint(p);
              setMoved(true);
            }}
          />
          <p className="mt-2 text-xs text-muted">Drag the pin, or tap the map, to set the exact spot.</p>
        </div>
      ) : null}

      {moved && point ? (
        <>
          <input type="hidden" name="pin_lat" value={point.lat} />
          <input type="hidden" name="pin_lng" value={point.lng} />
          <input type="hidden" name="pin_moved" value="1" />
        </>
      ) : null}
    </div>
  );
}

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
 * rest of the form. Collapsed by default — most owners never need it, because
 * the address lookup is right — and it only sends `pin_moved=1` once the marker
 * has actually been moved, so simply opening the map changes nothing.
 *
 * When `askForPin` is set the save was refused because the address couldn't be
 * found (see `resolveCoords` in app/actions/listing.ts): the map opens itself
 * and says so, because "place this yourself" is useless advice next to a
 * collapsed map.
 */
export function PinField({
  initial,
  city,
  hasPoint,
  askForPin = false,
}: {
  initial: LatLng | null;
  city: string;
  /** Whether the listing already has coordinates (affects the wording). */
  hasPoint: boolean;
  /** The address didn't resolve — open the map and ask for a pin. */
  askForPin?: boolean;
}) {
  const [open, setOpen] = useState(askForPin);
  const [point, setPoint] = useState<LatLng | null>(initial);
  const [moved, setMoved] = useState(false);

  // A refused save arrives as a prop change, not an event, so the map is
  // opened while rendering rather than in an effect — React's own pattern for
  // "adjust state when a prop changes", and one render instead of two.
  const [asked, setAsked] = useState(askForPin);
  if (askForPin !== asked) {
    setAsked(askForPin);
    if (askForPin) setOpen(true);
  }

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
        <span className={`text-xs ${askForPin && !moved ? "text-danger" : "text-muted"}`}>
          {moved
            ? "Pin set — this is where the room will show."
            : askForPin
              ? "We couldn't find that address. Drag the pin to where the room is."
              : hasPoint
                ? "We placed it from the address. Move it if it's off."
                : "Optional — we'll place it from the address when you save."}
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

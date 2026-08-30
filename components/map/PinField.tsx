"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { previewAddressAction } from "@/app/actions/listing";
import type { LatLng } from "@/lib/geo";

const PinPicker = dynamic(() => import("@/components/map/PinPicker"), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-2xl border border-hairline bg-surface sm:h-64" />,
});

type PreviewStatus = "idle" | "loading" | "found" | "missing" | "unavailable";

/** How long to wait after the owner stops typing before asking Nominatim. */
const DEBOUNCE_MS = 700;

/**
 * The listing form's map row: shows where the room will be placed as the
 * address is typed — not only after Publish is pressed — and lets the owner
 * drag the pin to correct it.
 *
 * The address is looked up again at save time regardless (`resolveCoords` in
 * `app/actions/listing.ts`); this is a preview of that lookup, not a
 * replacement for it, so a fake address still gets refused on save even if
 * this preview never runs. Once the owner drags the pin, later previews stop
 * moving it — a placement they made on purpose outranks a lookup, exactly as
 * it does on save (2026-08-29).
 */
export function PinField({
  initial,
  street,
  houseNumber,
  city,
  hasPoint,
}: {
  initial: LatLng | null;
  street: string;
  houseNumber: string;
  city: string;
  /** Whether the listing already has coordinates — skips re-asking Nominatim for the address it was saved with. */
  hasPoint: boolean;
}) {
  const [point, setPoint] = useState<LatLng | null>(initial);
  const [moved, setMoved] = useState(false);
  const [status, setStatus] = useState<PreviewStatus>(hasPoint ? "found" : "idle");
  const requestId = useRef(0);
  const settledFor = useRef(hasPoint ? `${street.trim()}|${houseNumber.trim()}|${city.trim()}` : null);

  const s = street.trim();
  const h = houseNumber.trim();
  const c = city.trim();
  const complete = s.length >= 2 && h.length > 0 && c.length > 0;

  useEffect(() => {
    if (moved || !complete) return; // the owner's own placement is never overwritten by a later lookup
    const key = `${s}|${h}|${c}`;
    if (key === settledFor.current) return;

    const id = ++requestId.current;
    setStatus("loading");
    const timer = setTimeout(async () => {
      const outcome = await previewAddressAction(s, h, c);
      if (id !== requestId.current) return; // a newer address was typed meanwhile
      settledFor.current = key;
      setStatus(outcome.status);
      if (outcome.status === "found") setPoint({ lat: outcome.lat, lng: outcome.lng });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [s, h, c, moved, complete]);

  const displayStatus: PreviewStatus = complete ? status : "idle";

  return (
    <div>
      <p className="text-xs text-muted">
        {moved
          ? "Pin set — this is where the room will show."
          : displayStatus === "loading"
            ? "Locating…"
            : displayStatus === "found"
              ? "This is where the room will show. Drag the pin if it's off."
              : displayStatus === "missing"
                ? "We couldn't find this address — check the spelling, or drop the pin yourself."
                : displayStatus === "unavailable"
                  ? "Couldn't check the address just now — it's checked again when you save."
                  : "Fill in the street and house number to see it on the map, or place the pin yourself."}
      </p>

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

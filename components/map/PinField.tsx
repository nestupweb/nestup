"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { previewAddressAction } from "@/app/actions/listing";
import type { LatLng } from "@/lib/geo";

const AddressPreviewMap = dynamic(() => import("@/components/map/AddressPreviewMap"), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-2xl border border-hairline bg-surface sm:h-64" />,
});

type PreviewStatus = "idle" | "loading" | "found" | "missing" | "unavailable";

/** How long to wait after the owner stops typing before asking Nominatim. */
const DEBOUNCE_MS = 700;

/**
 * The listing form's map row: shows where the room will be placed as the
 * address is typed — not only after Publish is pressed.
 *
 * Read-only (2026-08-30): there is no pin to drag any more, so a mistyped
 * address can't be quietly "corrected" past the check. The address is looked
 * up again at save time regardless (`resolveCoords` in `app/actions/listing.ts`)
 * and a bad one is refused there too — this preview just surfaces the same
 * answer immediately, instead of only once Publish is pressed.
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
  const [status, setStatus] = useState<PreviewStatus>(hasPoint ? "found" : "idle");
  const requestId = useRef(0);
  const settledFor = useRef(hasPoint ? `${street.trim()}|${houseNumber.trim()}|${city.trim()}` : null);

  const s = street.trim();
  const h = houseNumber.trim();
  const c = city.trim();
  const complete = s.length >= 2 && h.length > 0 && c.length > 0;

  useEffect(() => {
    if (!complete) return;
    const key = `${s}|${h}|${c}`;
    if (key === settledFor.current) return;

    const id = ++requestId.current;
    setStatus("loading");
    const timer = setTimeout(async () => {
      const outcome = await previewAddressAction(s, h, c);
      if (id !== requestId.current) return; // a newer address was typed meanwhile
      settledFor.current = key;
      setStatus(outcome.status);
      setPoint(outcome.status === "found" ? { lat: outcome.lat, lng: outcome.lng } : null);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [s, h, c, complete]);

  const displayStatus: PreviewStatus = complete ? status : "idle";

  return (
    <div>
      {displayStatus === "missing" ? (
        <p role="alert" className="text-sm text-danger">
          This address doesn&rsquo;t exist. Check the street name and house number.
        </p>
      ) : (
        <p className="text-xs text-muted">
          {displayStatus === "loading"
            ? "Locating…"
            : displayStatus === "found"
              ? "This is where the room will show."
              : displayStatus === "unavailable"
                ? "Couldn't check the address just now — it's checked again when you save."
                : "Fill in the street and house number to see it on the map."}
        </p>
      )}

      {point ? (
        <div className="mt-3">
          <AddressPreviewMap point={point} />
        </div>
      ) : null}
    </div>
  );
}

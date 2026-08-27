import L from "leaflet";

/**
 * Map markers drawn as HTML rather than Leaflet's default PNG sprite: the
 * bundled sprite is a blue teardrop that ignores the theme, and pointing at
 * `/images/marker-icon.png` breaks under Next's asset handling. A div icon
 * carries the app's own accent colour in both themes and costs no requests.
 */

/** A single room. */
export function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: "nestup-pin",
    html:
      '<span class="block h-3.5 w-3.5 rounded-full border-2 border-[var(--accent-contrast)] bg-[var(--accent)] shadow-[0_1px_4px_rgba(0,0,0,0.4)]"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** A room on the results map, labelled with its rent. */
export function priceIcon(text: string, dimmed = false): L.DivIcon {
  const tone = dimmed
    ? "bg-[var(--surface)] text-[var(--muted)] border-[var(--hairline)]"
    : "bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]";
  return L.divIcon({
    className: "nestup-price",
    html: `<span class="inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-[0_2px_6px_rgba(0,0,0,0.25)] ${tone}">${text}</span>`,
    iconSize: [54, 20],
    iconAnchor: [27, 10],
  });
}

/** Several rooms too close together to separate at this zoom. */
export function clusterIcon(count: number): L.DivIcon {
  const size = count >= 100 ? 46 : count >= 10 ? 40 : 34;
  return L.divIcon({
    className: "nestup-cluster",
    html: `<span class="flex items-center justify-center rounded-full border-2 border-[var(--accent-contrast)] bg-[var(--accent)] font-semibold text-[var(--accent-contrast)] shadow-[0_2px_8px_rgba(0,0,0,0.3)]" style="width:${size}px;height:${size}px;font-size:${count >= 100 ? 12 : 13}px">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * `cn` exists because mapcn's map component (components/ui/map.tsx) is copied
 * in from a shadcn registry and expects it. The shadcn original wraps
 * clsx + tailwind-merge; this app has neither, and the map component only ever
 * calls it as `cn("fixed classes", conditional && "...", props.className)`,
 * so joining the truthy parts is all it needs. No class-conflict resolution:
 * where a caller has to override one of the map's own utilities, the map file
 * is ours to edit.
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

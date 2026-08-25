import { AvatarImage } from "@/components/ui/AvatarImage";

const DIMS = { 10: "h-10 w-10", 12: "h-12 w-12", 14: "h-14 w-14", 16: "h-16 w-16", 20: "h-20 w-20", 28: "h-28 w-28" } as const;
const PX = { 10: 40, 12: 48, 14: 56, 16: 64, 20: 80, 28: 112 } as const;

/** Hosts the image optimizer may fetch (next.config remotePatterns); anything else is served as-is. */
function optimizable(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "images.unsplash.com" ||
        (u.hostname.endsWith(".supabase.co") && u.pathname.startsWith("/storage/v1/object/public/")))
    );
  } catch {
    return false; // relative, blob: or data: URLs
  }
}

/**
 * Round avatar. The outline-person placeholder from the reference design is
 * always painted underneath; the photo (routed through the image optimizer,
 * like listing photos) covers it once it loads. The picture carries no alt
 * text on purpose — a slow or blocked image must never print the person's
 * name inside the circle — so the wrapper names the image for assistive tech.
 */
export function Avatar({
  url,
  name,
  size = 12,
  className = "",
}: {
  url: string | null | undefined;
  name?: string | null;
  size?: keyof typeof DIMS;
  className?: string;
}) {
  return (
    <span
      role={name ? "img" : undefined}
      aria-label={name ?? undefined}
      className={`relative ${DIMS[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full text-ink ${
        url ? "" : "border-[1.5px] border-ink"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[55%] w-[55%]"
        aria-hidden="true"
      >
        <circle cx="12" cy="9" r="3.5" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>
      {url ? <AvatarImage src={url} sizes={`${PX[size]}px`} unoptimized={!optimizable(url)} /> : null}
    </span>
  );
}

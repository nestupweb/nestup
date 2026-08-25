/** Round avatar with the outline-person fallback from the reference design. */
export function Avatar({
  url,
  name,
  size = 12,
  className = "",
}: {
  url: string | null | undefined;
  name?: string | null;
  size?: 10 | 12 | 14 | 16 | 28;
  className?: string;
}) {
  const dims = { 10: "h-10 w-10", 12: "h-12 w-12", 14: "h-14 w-14", 16: "h-16 w-16", 28: "h-28 w-28" }[size];
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ""}
        className={`${dims} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      role={name ? "img" : undefined}
      aria-label={name ?? undefined}
      className={`${dims} flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-ink ${className}`}
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
    </span>
  );
}

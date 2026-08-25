/** Elegant no-photo fallback: subtle house glyph on a token surface. */
export function NoPhoto({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-surface text-muted ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 opacity-60"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9v12h14V9" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
      <span className="text-[11px] font-medium uppercase tracking-widest">No photo yet</span>
    </div>
  );
}

export default function BrowseLoading() {
  return (
    <main className="px-5 pb-16" aria-busy="true" aria-label="Loading listings">
      <div className="h-9 w-44 animate-pulse rounded-lg bg-hairline" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-hairline" />
      <div className="mt-5 h-11 animate-pulse rounded-xl border border-hairline bg-surface sm:h-40" />
      <div className="mt-4 h-4 w-36 animate-pulse rounded bg-hairline" />
      <div className="mt-5 flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-36 overflow-hidden rounded-2xl border border-hairline bg-surface sm:min-h-44"
          >
            <div className="w-32 shrink-0 animate-pulse bg-hairline sm:w-2/5" />
            <div className="flex-1 p-4 sm:p-5">
              <div className="h-7 w-28 animate-pulse rounded bg-hairline" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-hairline" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-hairline" />
              <div className="mt-4 h-3 w-2/3 animate-pulse rounded bg-hairline" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

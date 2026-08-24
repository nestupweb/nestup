export default function BrowseLoading() {
  return (
    <main className="px-4 pb-16 sm:px-6" aria-busy="true" aria-label="Loading listings">
      <div className="h-9 w-44 animate-pulse rounded-lg bg-hairline" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-hairline" />
      <div className="mt-5 lg:mt-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="h-11 animate-pulse rounded-xl border border-hairline bg-surface lg:h-[calc(100dvh-3rem)]" />
        <div>
          <div className="mt-4 h-4 w-36 animate-pulse rounded bg-hairline lg:mt-0" />
          <div className="mt-4 flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-36 overflow-hidden rounded-2xl border border-hairline bg-surface sm:min-h-44 md:min-h-52"
          >
            <div className="w-32 shrink-0 animate-pulse bg-hairline sm:w-56 md:w-72 lg:w-80" />
            <div className="flex-1 p-4 sm:p-5">
              <div className="h-7 w-28 animate-pulse rounded bg-hairline lg:h-5 lg:w-3/5" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-hairline" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-hairline" />
              <div className="mt-4 h-3 w-2/3 animate-pulse rounded bg-hairline" />
            </div>
            <div className="hidden w-44 shrink-0 border-l border-hairline p-5 lg:block">
              <div className="ml-auto h-7 w-24 animate-pulse rounded bg-hairline" />
            </div>
          </div>
        ))}
          </div>
        </div>
      </div>
    </main>
  );
}

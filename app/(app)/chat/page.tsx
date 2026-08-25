// Desktop-only placeholder for the right pane; on phones the layout shows the list instead.
export default function ChatIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5Z" />
        </svg>
      </span>
      <p className="mt-4 text-2xl font-semibold">Your messages</p>
      <p className="mt-1 max-w-xs text-sm text-muted">
        Pick a conversation on the left, or message an owner from any room to start one.
      </p>
    </div>
  );
}

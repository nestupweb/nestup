export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mx-auto mt-20 max-w-sm px-6 text-center">
      <p className="font-serif text-2xl font-semibold">{title}</p>
      {hint ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

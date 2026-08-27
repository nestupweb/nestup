/** The shell every Settings section sits in: one titled, bordered card. */
export function Card({
  title,
  hint,
  children,
  tone = "normal",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  tone?: "normal" | "danger";
}) {
  const danger = tone === "danger";
  return (
    <section
      aria-label={title}
      className={`mt-6 rounded-2xl border bg-surface px-4 py-5 sm:px-5 ${danger ? "border-danger/40" : "border-hairline"}`}
    >
      <h2 className={`text-[11px] font-bold uppercase tracking-[0.18em] ${danger ? "text-danger" : "text-accent"}`}>
        {title}
      </h2>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

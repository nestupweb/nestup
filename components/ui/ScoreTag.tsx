import { scoreLabel } from "@/lib/compatibility";

export function ScoreTag({ lifestyle, social }: { lifestyle: number; social: number | null }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/55 px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-white backdrop-blur-sm"
      title={`Lifestyle: ${scoreLabel(lifestyle)}${social !== null ? ` · Social: ${scoreLabel(social)}` : ""}`}
    >
      {lifestyle} LIFESTYLE
      <span aria-hidden className="opacity-50">·</span>
      {social === null ? <span title="Add interests to see social match">— SOCIAL</span> : <>{social} SOCIAL</>}
    </span>
  );
}

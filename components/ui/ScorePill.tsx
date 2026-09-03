import { scoreLabel } from "@/lib/compatibility";

/**
 * One compatibility number with its label — the same pill on the swipe card and
 * on a Listings row, so a room scores the same everywhere a member sees it.
 *
 * It lived inside `SwipeCard` until Listings needed it too. Sharing the
 * component rather than copying it is the point: the number, the "out of 100"
 * phrasing and the `scoreLabel` band are what a member compares between the two
 * pages, and two copies would eventually disagree about one of them.
 *
 * `tone` is the only thing that differs. On swipe the pill sits on top of a
 * full-bleed photo and has to hold its own against whatever is behind it, so it
 * is white on a blurred scrim. On a Listings row it sits on the card surface
 * and uses the theme tokens instead, which is what keeps it legible in both
 * Editorial and Noir without a second set of colours.
 *
 * Deliberately not colour-coded by band. A green 80 and a red 23 would read
 * faster, but swipe does not do it, and a member scanning Listings should see
 * the same pill they saw on the deck rather than a different visual language
 * for the same number.
 */
export function ScorePill({
  value,
  label,
  tone = "overlay",
}: {
  /** 0–100, or null when the score cannot be computed (no interests on either side). */
  value: number | null;
  /** Shown in the pill and read out by screen readers. */
  label: string;
  tone?: "overlay" | "surface";
}) {
  const text =
    value === null
      ? `${label} unavailable — add interests to your profile to see it`
      : `${label} ${value} out of 100, ${scoreLabel(value)}`;

  const shell =
    tone === "overlay"
      ? "bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-md"
      : "border border-hairline bg-paper/70 text-ink";
  const badge = tone === "overlay" ? "bg-white/15" : "bg-hairline";
  const caption = tone === "overlay" ? "text-white/90" : "text-muted";
  const size =
    tone === "overlay"
      ? "gap-2.5 py-1 pl-1 pr-3.5"
      : "gap-1.5 py-0.5 pl-0.5 pr-2";
  const badgeSize =
    tone === "overlay"
      ? "h-8 min-w-8 px-1.5 text-[16px]"
      : "h-6 min-w-6 px-1 text-[13px]";
  const captionSize =
    tone === "overlay"
      ? "text-[11px] tracking-[0.16em]"
      : "text-[10px] tracking-[0.12em]";

  return (
    <div
      role="img"
      aria-label={text}
      title={text}
      className={`flex items-center rounded-full ${size} ${shell}`}
    >
      <span
        className={`flex items-center justify-center rounded-full font-semibold tabular-nums ${badgeSize} ${badge}`}
      >
        {value === null ? "—" : value}
      </span>
      <span className={`font-semibold uppercase ${captionSize} ${caption}`}>{label}</span>
    </div>
  );
}

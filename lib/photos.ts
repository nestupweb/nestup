/** Rooms a swipe story opens with, in order; everything else follows in the order it was posted. */
const STORY_ORDER = ["living_room", "bedroom", "bathroom"] as const;

/**
 * A listing's photos in story order for the Swipe deck: the living room, then
 * the bedroom, then the bathroom, then the rest as the host arranged them.
 * Untagged photos keep their place after the tagged three. Stable, so two
 * bedrooms stay in the host's order.
 */
export function orderPhotos(urls: string[], labels: string[] = []): { urls: string[]; labels: string[] } {
  const rank = (i: number) => {
    const at = STORY_ORDER.indexOf(labels[i] as (typeof STORY_ORDER)[number]);
    return at === -1 ? STORY_ORDER.length : at;
  };
  const order = urls.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b);
  return { urls: order.map((i) => urls[i]), labels: order.map((i) => labels[i] ?? "") };
}

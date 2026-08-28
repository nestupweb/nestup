"use server";

import { requireUser } from "@/lib/auth";
import { DWELL_CAP_MS, DWELL_FLOOR_MS } from "@/lib/affinity";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clamp = (value: unknown, max: number): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
};

/**
 * Store how much attention one room got. Fire-and-forget from the deck: a lost
 * reading costs a little ranking quality and must never interrupt swiping, so
 * every failure path returns quietly instead of throwing.
 *
 * The caps are re-applied here rather than trusted from the client — they match
 * the CHECK constraints in migration 0035, so a forged request is clamped to
 * the same ceiling as an honest one instead of being rejected.
 */
export async function recordDwellAction(
  listingId: string,
  dwellMs: number,
  photosSeen: number,
  pagesSeen: number
): Promise<{ ok: boolean }> {
  if (!UUID.test(listingId)) return { ok: false };
  const dwell = clamp(dwellMs, DWELL_CAP_MS);
  // A glance is not evidence. Dropping these keeps the table to rooms the
  // seeker actually considered.
  if (dwell < DWELL_FLOOR_MS) return { ok: false };

  const { supabase, user } = await requireUser();

  // Keep the strongest reading for this room rather than the latest: a seeker
  // who reloads and skips straight past should not erase a long earlier look.
  const { data: existing } = await supabase
    .from("listing_dwell")
    .select("dwell_ms, photos_seen, pages_seen")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  const { error } = await supabase.from("listing_dwell").upsert(
    {
      user_id: user.id,
      listing_id: listingId,
      dwell_ms: Math.max(dwell, existing?.dwell_ms ?? 0),
      photos_seen: Math.max(clamp(photosSeen, 20), existing?.photos_seen ?? 0),
      pages_seen: Math.max(clamp(pagesSeen, 10), existing?.pages_seen ?? 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,listing_id" }
  );
  return { ok: !error };
}

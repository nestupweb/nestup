import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Anonymous, cookie-free Supabase client for reads that are identical for
 * everyone — the Listings index being the one that matters.
 *
 * Why it exists: `lib/supabase/server.ts` reads cookies, and anything that
 * reads cookies can only go in a per-browser `use cache: private` scope. The
 * public room list is the same bytes for every visitor, so it belongs in the
 * shared `use cache` where one fetch serves everybody and the result can be
 * prerendered. This client carries no session, so it sees exactly what a
 * logged-out visitor sees and can never widen a row set for one member.
 *
 * Use it ONLY for genuinely public data. Anything scoped to a member must keep
 * going through the cookie-bearing client so RLS applies to them personally.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

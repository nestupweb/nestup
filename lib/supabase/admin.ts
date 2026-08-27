import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS, so it is imported by `lib/notify.ts` and
 * nothing else. Never import this from a component, a client module, or an
 * action that runs on behalf of a member — it can read every row in the
 * project. Returns null when the key is absent (local dev, CI), and every
 * caller must cope with that rather than assume it is there.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

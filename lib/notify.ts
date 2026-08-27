import { lifestyleScore, socialScore, sortKey } from "@/lib/compatibility";
import { MIN_DECK_SCORE, fitsHardFilters } from "@/lib/swipe";
import { newMatchSubject, renderNewMatch, renderNewMatchText } from "@/lib/email/new-match";
import type { Listing, Profile } from "@/lib/types";

export { renderNewMatch };

/** A member who opted in, paired with the address to write to. */
export type Candidate = { profile: Profile; email: string };

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://nestup-kappa.vercel.app").replace(/\/$/, "");

/**
 * Everyone who should hear about a newly published room: they opted in, they
 * are not the lister, and the room would have reached their Swipe deck. The
 * three rules are exactly the deck's, so the e-mail can never advertise a room
 * the app itself would have filtered out.
 */
export function matchingSeekers(listing: Listing, owner: Profile, candidates: Candidate[]): Candidate[] {
  return candidates.filter(({ profile, email }) => {
    if (!profile.notify_new_matches) return false;
    if (profile.user_id === listing.owner_id) return false;
    if (!email) return false;
    if (!fitsHardFilters(profile, listing)) return false;
    const lifestyle = lifestyleScore(profile, listing, owner, "seeker");
    return sortKey(lifestyle, socialScore(profile, owner)) >= MIN_DECK_SCORE;
  });
}

/**
 * Fan-out for a freshly published room. Called from `after()` so it runs once
 * the lister already has their response, and wrapped end to end: a failure here
 * is logged and dropped, never surfaced as a failed publish.
 *
 * Reading other members' profiles and addresses is not something the lister's
 * own session may do, so this is the one place that uses the service-role
 * client.
 */
export async function notifyNewListing(listingId: string): Promise<number> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    if (!admin) {
      console.warn("[notify] SUPABASE_SERVICE_ROLE_KEY not set — skipping new-match e-mail");
      return 0;
    }

    const { data: listingRow } = await admin.from("listings").select("*").eq("id", listingId).maybeSingle();
    const listing = (listingRow as Listing | null) ?? null;
    if (!listing || !listing.is_active) return 0;

    const [{ data: ownerRow }, { data: optedInRows }] = await Promise.all([
      admin.from("profiles").select("*").eq("user_id", listing.owner_id).maybeSingle(),
      admin.from("profiles").select("*").eq("notify_new_matches", true),
    ]);
    const owner = (ownerRow as Profile | null) ?? null;
    const optedIn = (optedInRows as Profile[] | null) ?? [];
    if (!owner || optedIn.length === 0) return 0;

    // Preferred address first, auth address as the fallback.
    const ids = optedIn.map((p) => p.user_id);
    const { data: detailRows } = await admin
      .from("profile_details")
      .select("user_id, contact_email")
      .in("user_id", ids);
    const preferred = new Map(
      ((detailRows as { user_id: string; contact_email: string | null }[] | null) ?? []).map((d) => [
        d.user_id,
        (d.contact_email ?? "").trim(),
      ])
    );
    const { data: userPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authEmail = new Map((userPage?.users ?? []).map((u) => [u.id, u.email ?? ""]));

    const candidates: Candidate[] = optedIn.map((profile) => ({
      profile,
      email: preferred.get(profile.user_id) || authEmail.get(profile.user_id) || "",
    }));

    const recipients = matchingSeekers(listing, owner, candidates);
    if (recipients.length === 0) return 0;

    const { sendMail } = await import("@/lib/mail");
    const site = SITE();
    const html = renderNewMatch(listing, site);
    // Multipart + a List-Unsubscribe header: this is opt-in mail, and both are
    // what keeps a small sender out of the junk folder.
    const text = renderNewMatchText(listing, site);
    const unsubscribeUrl = `${site}/settings`;
    const subject = newMatchSubject(listing);
    let sent = 0;
    // One at a time: Gmail is the transport, and a burst of parallel sends is
    // the fastest way to be throttled.
    for (const r of recipients) {
      if (await sendMail({ to: r.email, subject, html, text, unsubscribeUrl })) sent += 1;
    }
    console.info(`[notify] new listing ${listing.id}: ${sent}/${recipients.length} e-mails sent`);
    return sent;
  } catch (e) {
    console.error("[notify] new-match fan-out failed", e);
    return 0;
  }
}

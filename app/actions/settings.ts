"use server";

import { refresh, updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { LISTINGS_TAG, deckTag, listingTag, profileTag } from "@/lib/cache-tags";

/**
 * `done` is set only by `deleteAccountAction`, and only on success. It exists
 * because closing an account has to end in a full document load rather than a
 * soft `redirect()` — see the comment there.
 */
export type ToggleState = { error?: string; done?: boolean };

const SAVE_FAILED = "Could not save. Please try again.";

/**
 * Contact visibility. The column only decides what
 * `public_profile_details()` hands to other members (migration 0023) — the
 * owner always sees their own values.
 */
export async function setPrivacyAction(
  field: "show_phone" | "show_contact_email",
  value: boolean
): Promise<ToggleState> {
  // `field` is a union, so nothing unchecked ever reaches the column name.
  if (field !== "show_phone" && field !== "show_contact_email") return { error: SAVE_FAILED };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profile_details")
    .upsert({ user_id: user.id, [field]: value, updated_at: new Date().toISOString() });
  if (error) return { error: SAVE_FAILED };
  // The visibility flag is part of the member's own profile details, which the
  // Profile tabs cache. Settings itself is uncached, so the rerun covers it.
  updateTag(profileTag(user.id));
  refresh();
  return {};
}

/** Opt in or out of the "a new room matches you" e-mail. */
export async function setNotifyAction(value: boolean): Promise<ToggleState> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ notify_new_matches: value, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return { error: SAVE_FAILED };
  // Nothing cached reads this flag — only the mailer does. Rerunning the
  // settings route in view is enough to move the switch.
  refresh();
  return {};
}

/** Pause or resume the member's own listing — the same flag as the listing form. */
export async function setListingActiveAction(listingId: string, value: boolean): Promise<ToggleState> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("listings")
    .update({ is_active: value, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("owner_id", user.id);
  if (error) return { error: SAVE_FAILED };
  // Same four tags the listing form uses, because this is the same change: a
  // paused room leaves the public list and the room's own page, and the owner
  // sees it greyed on their profile.
  //
  // Other members' decks keep the room for up to their own cache window. That is
  // the deliberate cost of `use cache: private` — a deck lives in its member's
  // browser, so no one else's action can reach it — and it self-corrects: the
  // listing page a stale card links to is already gone by the time it is opened.
  updateTag(LISTINGS_TAG);
  updateTag(listingTag(listingId));
  updateTag(profileTag(user.id));
  updateTag(deckTag(user.id));
  refresh();
  return {};
}

/**
 * Closes the account. The typed address must match the session's own e-mail;
 * `delete_own_account()` then removes the `auth.users` row and every app table
 * cascades from it (migration 0001), so nothing is left behind.
 *
 * A listing with confirmed roommates on it does *not* cascade away: it changes
 * hands first, inside the same transaction (migration 0040). One roommate takes
 * it without being asked; with several, `heir` says who, and the database
 * refuses the deletion if that choice is missing or isn't one of them — the
 * picker in `DangerZone` is the convenience, this is the rule.
 */
export async function deleteAccountAction(_prev: ToggleState, formData: FormData): Promise<ToggleState> {
  const typed = String(formData.get("confirm_email") ?? "").trim().toLowerCase();
  const heir = String(formData.get("heir") ?? "").trim();
  const { supabase, user } = await requireUser();
  if (!typed || typed !== (user.email ?? "").toLowerCase()) {
    return { error: "Type your e-mail address exactly as it appears above." };
  }
  const { error } = await supabase.rpc("delete_own_account", { p_heir: heir || null });
  if (error) {
    // The two the database raises on purpose, said in the member's language.
    if (error.hint === "pick_heir" || /choose who takes over/.test(error.message)) {
      return { error: "Choose which roommate takes over your listing." };
    }
    if (error.hint === "bad_heir" || /cannot take over/.test(error.message)) {
      return { error: "That roommate can't take over the listing. Pick someone else." };
    }
    return { error: "Could not delete the account. Please try again." };
  }
  await supabase.auth.signOut();
  // Not `redirect("/")`. That is a soft navigation, so the member's cached deck,
  // profile tabs and inbox — and the router's rendered copies of those pages —
  // would still be sitting in the tab after the account they belong to had been
  // deleted. `DangerZone` takes this flag and does a real document load, which
  // is what empties them. Same reasoning as `app/auth/signout/route.ts`.
  return { done: true };
}

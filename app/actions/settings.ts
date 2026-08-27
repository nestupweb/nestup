"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export type ToggleState = { error?: string };

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
  revalidatePath("/settings");
  revalidatePath("/profile");
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
  revalidatePath("/settings");
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
  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/browse");
  revalidatePath("/swipe");
  return {};
}

/**
 * Closes the account. The typed address must match the session's own e-mail;
 * `delete_own_account()` then removes the `auth.users` row and every app table
 * cascades from it (migration 0001), so nothing is left behind.
 */
export async function deleteAccountAction(_prev: ToggleState, formData: FormData): Promise<ToggleState> {
  const typed = String(formData.get("confirm_email") ?? "").trim().toLowerCase();
  const { supabase, user } = await requireUser();
  if (!typed || typed !== (user.email ?? "").toLowerCase()) {
    return { error: "Type your e-mail address exactly as it appears above." };
  }
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: "Could not delete the account. Please try again." };
  await supabase.auth.signOut();
  redirect("/");
}

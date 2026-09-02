"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { deckTag, profileTag } from "@/lib/cache-tags";
import { isDailyLifeComplete } from "@/lib/daily-life";
import { sanitizeNextPath } from "@/lib/redirect";
import { uploadImage } from "@/lib/storage";
import { profileSchema } from "@/lib/validation/profile";
import { aboutDetailsFromForm, aboutDetailsSchema } from "@/lib/validation/about";

export type ProfileFormState = {
  error?: string;
  /** Field name → message, so the form can highlight each one that failed. */
  fieldErrors?: Record<string, string>;
  /** Saved, but the Daily life table is still short of answers (a warning, not a block). */
};

const ABOUT_LABELS: Record<string, string> = {
  contact_email: "Email",
  wake_time: "Wake-up time",
  bed_time: "Bedtime",
};

/** The four the form will not save without — each highlighted where it sits. */
const REQUIRED_BASICS = ["full_name", "age", "gender", "occupation"] as const;

export async function upsertProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    age: formData.get("age"),
    occupation: formData.get("occupation") ?? "",
    gender: formData.get("gender"),
    bio: formData.get("bio") ?? "",
    // Daily life is passed through raw: the schema turns a blank into null
    // ("not answered yet", 0035). Reading it as `=== "on"` here would have
    // collapsed unanswered into a confident No.
    smoker: formData.get("smoker"),
    has_pet: formData.get("has_pet"),
    cleanliness: formData.get("cleanliness"),
    sleep_schedule: formData.get("sleep_schedule"),
    guests_freq: formData.get("guests_freq"),
    // Optional so older forms (and the onboarding form) still validate; the
    // schema defaults them. `?? undefined`: a missing field is undefined, not null.
    noise_level: formData.get("noise_level") ?? undefined,
    diet: formData.get("dietary") ?? undefined,
    shabbat: formData.get("shabbat") ?? undefined,
    interests: formData.getAll("interests"),
    chores: formData.getAll("chores"),
    ok_with_smoker: formData.get("ok_with_smoker"),
    ok_with_pets: formData.get("ok_with_pets"),
    pref_cleanliness: formData.get("pref_cleanliness") ?? undefined,
    pref_sleep: formData.get("pref_sleep") ?? undefined,
    pref_guests: formData.get("pref_guests") ?? undefined,
    pref_noise: formData.get("pref_noise") ?? undefined,
    pref_diet: formData.get("pref_diet") ?? undefined,
    pref_shabbat: formData.get("pref_shabbat") ?? undefined,
    pref_same_gender: formData.get("pref_same_gender"),
    budget_min: formData.get("budget_min") || 0,
    budget_max: formData.get("budget_max") || 0,
    preferred_cities: formData.getAll("preferred_cities"),
    earliest_move_in: (formData.get("earliest_move_in") as string) || null,
    pref_lease_term: formData.get("pref_lease_term") ?? undefined,
    pref_safe_room: formData.get("pref_safe_room") ?? undefined,
    pref_amenities: formData.getAll("pref_amenities"),
  });
  if (!parsed.success) {
    // Every failing field, not just the first: the form marks each one where it
    // sits, so a member fixing three blanks sees all three at once.
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.length ? String(issue.path[0]) : "";
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    const missingBasics = REQUIRED_BASICS.filter((f) => fieldErrors[f]);
    const issue = parsed.error.issues[0];
    const error = missingBasics.length
      ? "Some required details are missing — check the highlighted fields below."
      : issue
        ? issue.path.length
          ? String(issue.path[0]) + ": " + issue.message
          : issue.message
        : "Please check the form.";
    return { error, fieldErrors };
  }

  // The pencil page carries the About-me details in the same form
  // (`PROFILE_EDIT_ON_PENCIL_PAGE`); validate them before touching anything.
  const withAbout = formData.has("about");
  const about = withAbout ? aboutDetailsSchema.safeParse(aboutDetailsFromForm(formData)) : null;
  if (about && !about.success) {
    const issue = about.error.issues[0];
    const field = issue?.path.length ? String(issue.path[0]) : "";
    return { error: issue ? (field ? `${ABOUT_LABELS[field] ?? field}: ${issue.message}` : issue.message) : "Please check the About me section." };
  }

  let avatar_url: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    try {
      avatar_url = await uploadImage(supabase, "avatars", user.id, avatar);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Avatar upload failed." };
    }
  }

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    ...parsed.data,
    ...(avatar_url ? { avatar_url } : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save your profile. Please try again." };

  if (about?.success) {
    const { error: aboutError } = await supabase
      .from("profile_details")
      .upsert({ user_id: user.id, ...about.data, updated_at: new Date().toISOString() });
    if (aboutError) return { error: "Your profile was saved, but the About me section could not be. Please try again." };
  }

  // This member's own two caches. The deck matters as much as the profile here:
  // every Daily-life answer and preference on this form is an input to the match
  // score the deck is ranked and gated on, so a saved profile that left a stale
  // deck in place would show rooms picked for the old answers.
  updateTag(profileTag(user.id));
  updateTag(deckTag(user.id));
  // Onboarding entered from a gated page (e.g. chat) returns there; default /swipe.
  const target = sanitizeNextPath(String(formData.get("next") ?? ""));
  // Save ends the form and confirms on the page it lands on (user, 2026-09-02).
  // Both halves of that matter: a note left sitting on the form read as if the
  // save had failed, and a silent jump to the profile read as if nothing had
  // happened at all. So every save from the profile carries word of itself —
  // the Daily-life nudge when the table is short of answers, a plain "saved"
  // when it is not. The profile page is the only thing that renders either.
  //
  // A save heading anywhere else — onboarding into the deck or into a chat —
  // goes there as promised and stays quiet; those pages have nowhere to say it,
  // and nothing is gated on the table anyway.
  if (target === "/profile") {
    redirect(isDailyLifeComplete(parsed.data) ? "/profile?saved=1" : "/profile?saved=daily-life");
  }
  redirect(target);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sanitizeNextPath } from "@/lib/redirect";
import { uploadImage } from "@/lib/storage";
import { profileSchema } from "@/lib/validation/profile";
import { aboutDetailsFromForm, aboutDetailsSchema } from "@/lib/validation/about";

export type ProfileFormState = { error?: string };

const ABOUT_LABELS: Record<string, string> = {
  contact_email: "Email",
  wake_time: "Wake-up time",
  bed_time: "Bedtime",
};

export async function upsertProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    age: formData.get("age"),
    occupation: formData.get("occupation") ?? "",
    bio: formData.get("bio") ?? "",
    smoker: formData.get("smoker") === "on",
    has_pet: formData.get("has_pet") === "on",
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
    ok_with_smoker: formData.get("ok_with_smoker") === "on",
    ok_with_pets: formData.get("ok_with_pets") === "on",
    pref_cleanliness: formData.get("pref_cleanliness") ?? undefined,
    pref_sleep: formData.get("pref_sleep") ?? undefined,
    pref_guests: formData.get("pref_guests") ?? undefined,
    pref_noise: formData.get("pref_noise") ?? undefined,
    pref_diet: formData.get("pref_diet") ?? undefined,
    pref_shabbat: formData.get("pref_shabbat") ?? undefined,
    budget_min: formData.get("budget_min") || 0,
    budget_max: formData.get("budget_max") || 0,
    preferred_cities: formData.getAll("preferred_cities"),
    earliest_move_in: (formData.get("earliest_move_in") as string) || null,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? (issue.path.length ? String(issue.path[0]) + ": " + issue.message : issue.message) : "Please check the form." };
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

  revalidatePath("/profile");
  // Onboarding entered from a gated page (e.g. chat) returns there; default /swipe.
  redirect(sanitizeNextPath(String(formData.get("next") ?? "")));
}

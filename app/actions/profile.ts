"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sanitizeNextPath } from "@/lib/redirect";
import { uploadImage } from "@/lib/storage";
import { profileSchema } from "@/lib/validation/profile";
import { MAX_PROFILE_PHOTOS } from "@/lib/constants";

export type ProfileFormState = { error?: string };

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
    interests: formData.getAll("interests"),
    ok_with_smoker: formData.get("ok_with_smoker") === "on",
    ok_with_pets: formData.get("ok_with_pets") === "on",
    budget_min: formData.get("budget_min") || 0,
    budget_max: formData.get("budget_max") || 0,
    preferred_cities: formData.getAll("preferred_cities"),
    earliest_move_in: (formData.get("earliest_move_in") as string) || null,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? (issue.path.length ? String(issue.path[0]) + ": " + issue.message : issue.message) : "Please check the form." };
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

  // Extra pictures: kept URLs first, then new uploads (all into the caller's avatars folder).
  const photo_urls = formData.getAll("existing_photos").map(String).filter((u) => u.startsWith("https://"));
  const newPhotos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photo_urls.length + newPhotos.length > MAX_PROFILE_PHOTOS) {
    return { error: `Up to ${MAX_PROFILE_PHOTOS} extra photos.` };
  }
  for (const file of newPhotos) {
    try {
      photo_urls.push(await uploadImage(supabase, "avatars", user.id, file));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Photo upload failed." };
    }
  }

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    ...parsed.data,
    ...(avatar_url ? { avatar_url } : {}),
    photo_urls,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save your profile. Please try again." };

  revalidatePath("/profile");
  // Onboarding entered from a gated page (e.g. chat) returns there; default /swipe.
  redirect(sanitizeNextPath(String(formData.get("next") ?? "")));
}

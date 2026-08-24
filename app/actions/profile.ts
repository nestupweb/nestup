"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uploadImage } from "@/lib/storage";
import { profileSchema } from "@/lib/validation/profile";

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

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    ...parsed.data,
    ...(avatar_url ? { avatar_url } : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save your profile. Please try again." };

  revalidatePath("/profile");
  redirect("/swipe");
}

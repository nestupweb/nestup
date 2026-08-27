"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { aboutDetailsFromForm, aboutSchema } from "@/lib/validation/about";

export type AboutFormState = { error?: string };

const LABELS: Record<string, string> = {
  contact_email: "Email",
  wake_time: "Wake-up time",
  bed_time: "Bedtime",
  budget_max: "Budget",
  earliest_move_in: "Move-in date",
};

/** Saves the About me tab: private details → `profile_details`, shared basics → `profiles`. */
export async function saveAboutAction(_prev: AboutFormState, formData: FormData): Promise<AboutFormState> {
  const { supabase, user } = await requireUser();

  const parsed = aboutSchema.safeParse({
    ...aboutDetailsFromForm(formData),
    occupation: formData.get("occupation") ?? "",
    smoker: formData.get("smoker") === "on",
    has_pet: formData.get("has_pet") === "on",
    budget_min: formData.get("budget_min") || 0,
    budget_max: formData.get("budget_max") || 0,
    earliest_move_in: (formData.get("earliest_move_in") as string) || null,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (!issue) return { error: "Please check the form." };
    const field = issue.path.length ? String(issue.path[0]) : "";
    return { error: field ? `${LABELS[field] ?? field}: ${issue.message}` : issue.message };
  }

  const { occupation, smoker, has_pet, budget_min, budget_max, earliest_move_in, ...details } = parsed.data;
  const now = new Date().toISOString();

  const [detailsRes, profileRes] = await Promise.all([
    supabase.from("profile_details").upsert({ user_id: user.id, ...details, updated_at: now }),
    supabase
      .from("profiles")
      .update({ occupation, smoker, has_pet, budget_min, budget_max, earliest_move_in, updated_at: now })
      .eq("user_id", user.id),
  ]);
  if (detailsRes.error || profileRes.error) return { error: "Could not save. Please try again." };

  revalidatePath("/profile");
  // No confirmation line — a save drops the member straight back on their profile.
  redirect("/profile");
}

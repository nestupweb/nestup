import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_IMAGE_BYTES } from "@/lib/constants";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Uploads one image to `bucket` under the caller's own folder (RLS-enforced)
 * and returns its public URL. Throws Error with a user-safe message on bad input.
 */
export async function uploadImage(
  supabase: SupabaseClient,
  bucket: "avatars" | "listing-photos",
  userId: string,
  file: File
): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Only JPG, PNG, or WebP images are allowed.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller.");

  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
  });
  if (error) throw new Error("Upload failed. Please try again.");

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

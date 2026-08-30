import { z } from "zod";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * `<conversation uuid>/<uuid>.<ext>` for a photo, `<conversation uuid>/video/<uuid>.<ext>`
 * for a clip — the browser uploads there under storage RLS.
 *
 * The extension is deliberately not an allow-list any more. It used to be
 * `jpg|png|webp`, which quietly refused the message *after* the file had
 * already uploaded: every .mov, .mp4 and .heic became an orphaned object in
 * the bucket and a "failed to send" bubble. What actually keeps this safe is
 * the shape — the caller's own conversation folder (checked again in
 * `sendMessageAction`) and a uuid filename — plus the bucket's `image/*`,
 * `video/*` MIME limit, none of which the extension was adding to.
 */
const IMAGE_PATH = new RegExp(`^${UUID}/(video/)?${UUID}\\.[a-z0-9]{1,5}$`, "i");

export const messageSchema = z
  .object({
    content: z.string().trim().max(2000).default(""),
    image_path: z
      .string()
      .trim()
      .max(200)
      .refine((p) => p === "" || IMAGE_PATH.test(p), "Could not attach the file.")
      .default(""),
  })
  .refine((m) => m.content.length > 0 || m.image_path.length > 0, {
    message: "Write a message or add a photo or video.",
    path: ["content"],
  });

export type MessageInput = z.infer<typeof messageSchema>;

import { z } from "zod";

/** `<conversation uuid>/<uuid>.<jpg|png|webp>` — the browser uploads there under storage RLS. */
const IMAGE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export const messageSchema = z
  .object({
    content: z.string().trim().max(2000).default(""),
    image_path: z
      .string()
      .trim()
      .max(200)
      .refine((p) => p === "" || IMAGE_PATH.test(p), "Could not attach the photo.")
      .default(""),
  })
  .refine((m) => m.content.length > 0 || m.image_path.length > 0, {
    message: "Write a message or add a photo.",
    path: ["content"],
  });

export type MessageInput = z.infer<typeof messageSchema>;

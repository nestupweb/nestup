import { z } from "zod";

export const messageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export type MessageInput = z.infer<typeof messageSchema>;

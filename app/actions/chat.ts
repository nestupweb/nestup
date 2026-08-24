"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { messageSchema } from "@/lib/validation/message";

export type SendMessageState = { error?: string; content?: string; sentNonce?: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sendMessageAction(
  _prev: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const { supabase, user } = await requireUser();

  const conversationId = String(formData.get("conversation_id") ?? "");
  const listingId = String(formData.get("listing_id") ?? "");
  const raw = String(formData.get("content") ?? "");
  if (!UUID_RE.test(conversationId) || !UUID_RE.test(listingId)) {
    return { error: "Could not send the message. Please reload and try again.", content: raw };
  }

  const parsed = messageSchema.safeParse({ content: raw });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue ? (issue.path.length ? String(issue.path[0]) + ": " + issue.message : issue.message) : "Please check the message.",
      content: raw,
    };
  }

  // RLS allows the insert only when the sender is a participant of the conversation.
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: parsed.data.content,
  });
  if (error) return { error: "Could not send the message. Please try again.", content: raw };

  revalidatePath(`/browse/${listingId}/chat`);
  return { sentNonce: Date.now() };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { markConversationRead } from "@/lib/chat";
import { messageSchema } from "@/lib/validation/message";

export type SendMessageState = { error?: string; content?: string; sentNonce?: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sendMessageAction(
  _prev: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const { supabase, user } = await requireUser();

  const conversationId = String(formData.get("conversation_id") ?? "");
  const raw = String(formData.get("content") ?? "");
  const imageRaw = String(formData.get("image_path") ?? "");
  if (!UUID_RE.test(conversationId)) {
    return { error: "Could not send the message. Please reload and try again.", content: raw };
  }

  const parsed = messageSchema.safeParse({ content: raw, image_path: imageRaw });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue ? (issue.path.length ? String(issue.path[0]) + ": " + issue.message : issue.message) : "Please check the message.",
      content: raw,
    };
  }
  // A photo must live in this conversation's folder (uploaded from the browser under storage RLS).
  if (parsed.data.image_path && !parsed.data.image_path.startsWith(`${conversationId}/`)) {
    return { error: "Could not attach the photo. Please try again.", content: raw };
  }

  // RLS allows the insert only when the sender is a participant of the conversation.
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: parsed.data.content,
    image_path: parsed.data.image_path || null,
  });
  if (error) return { error: "Could not send the message. Please try again.", content: raw };

  await markConversationRead(supabase, conversationId);
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/chat");
  return { sentNonce: Date.now() };
}

/** Called when a thread is opened so the unread badge clears. */
export async function markReadAction(conversationId: string): Promise<void> {
  if (!UUID_RE.test(conversationId)) return;
  const { supabase, user } = await requireUser();
  await markConversationRead(supabase, conversationId);
  revalidatePath("/chat");
}

"use server";

import { refresh, updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { chatTag } from "@/lib/cache-tags";
import { clearConversation, markConversationRead } from "@/lib/chat";
import { messageSchema } from "@/lib/validation/message";
import type { Message } from "@/lib/types";

export type SendMessageInput = {
  conversationId: string;
  /** Browser-generated UUID; the same id can be retried safely (unique per conversation). */
  clientId: string;
  content: string;
  imagePath?: string | null;
};
export type SendMessageResult = { ok: true; message: Message } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC = "Could not send the message. Please try again.";

/**
 * Persist one chat message. Called in the background after the thread has
 * already shown the bubble optimistically; the returned row carries the
 * `client_id` the thread uses to swap the optimistic copy for the real one.
 * A retry of an already-delivered id returns the existing row (unique index).
 */
export async function sendMessageAction(input: SendMessageInput): Promise<SendMessageResult> {
  const { supabase, user } = await requireUser();

  const conversationId = String(input?.conversationId ?? "");
  const clientId = String(input?.clientId ?? "");
  if (!UUID_RE.test(conversationId) || !UUID_RE.test(clientId)) {
    return { ok: false, error: "Could not send the message. Please reload and try again." };
  }

  const parsed = messageSchema.safeParse({ content: input.content ?? "", image_path: input.imagePath ?? "" });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Please check the message." };
  }
  // A photo must live in this conversation's folder (uploaded from the browser under storage RLS).
  if (parsed.data.image_path && !parsed.data.image_path.startsWith(`${conversationId}/`)) {
    return { ok: false, error: "Could not attach the photo. Please try again." };
  }

  // RLS allows the insert only when the sender is a participant of the conversation.
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: parsed.data.content,
      image_path: parsed.data.image_path || null,
      client_id: clientId,
    })
    .select("*")
    .single();

  let message = data as Message | null;
  if (error) {
    // 23505 = unique violation: an earlier attempt already delivered this message.
    if (error.code !== "23505") return { ok: false, error: GENERIC };
    const { data: existing } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("client_id", clientId)
      .maybeSingle();
    message = (existing as Message | null) ?? null;
    if (!message) return { ok: false, error: GENERIC };
  }
  if (!message) return { ok: false, error: GENERIC };

  await markConversationRead(supabase, conversationId);
  // One tag and a rerun, and nothing wider than that.
  //
  // `updateTag(chatTag)` is new: the inbox is cached now, and this write moved
  // the thread to the top of it and changed its preview line, so the sender's
  // own copy has to go. It is `updateTag` rather than `revalidateTag` because
  // this is read-your-own-writes — the member must see their message land, not
  // a stale list for another 300 seconds.
  //
  // Still not `revalidatePath`: inside a Server Action that makes every
  // previously visited page re-fetch on its next visit, so every message sent
  // threw away the Swipe, Listings and Profile payloads the member had already
  // paid for. This drops exactly one member's inbox and reruns the route in
  // view.
  //
  // The *recipient's* inbox is not touched here, and cannot be — their cache
  // lives in their browser. Their `ChatRealtime` sees the insert and calls
  // `syncChatAction` for itself.
  updateTag(chatTag(user.id));
  refresh();
  return { ok: true, message };
}

/**
 * "Delete chat" from the Chats list — WhatsApp's version of it. The thread
 * leaves this member's inbox and its history stops being shown *to them*;
 * the other side keeps every message, and the next one they send brings the
 * chat back holding that message alone. Nothing is destroyed, so this needs no
 * second confirmation beyond the one the list already asks for.
 */
export async function deleteConversationAction(
  conversationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(conversationId)) return { ok: false, error: "Could not delete this chat." };
  const { supabase, user } = await requireUser();
  // RLS: the cutoff only inserts for a conversation this member takes part in.
  const ok = await clearConversation(supabase, conversationId);
  if (!ok) return { ok: false, error: "Could not delete this chat. Please try again." };
  // The inbox is cached now, so rerunning the route is no longer enough on its
  // own — the cached list still holds the row this just cleared. Drop the tag
  // first, then rerun.
  updateTag(chatTag(user.id));
  refresh();
  return { ok: true };
}

/** Called when a thread is opened so the unread badge clears. */
export async function markReadAction(conversationId: string): Promise<void> {
  if (!UUID_RE.test(conversationId)) return;
  const { supabase, user } = await requireUser();
  await markConversationRead(supabase, conversationId);
  // The unread count is part of the cached inbox row, so clearing it has to
  // drop the tag as well as rerun — otherwise opening a thread would leave the
  // blue count sitting on the row behind it.
  updateTag(chatTag(user.id));
  refresh();
}

/**
 * "Something changed in my chats" — called by `ChatRealtime` when the socket
 * reports a message or viewing this member can see.
 *
 * This exists because Chat is the one cache that a *different* member's write
 * invalidates. Everywhere else the member who changed something is the member
 * whose cache is wrong, and their own action clears it. Here the other side
 * sends a message and this browser's inbox is instantly out of date with no
 * action of its own running. The socket event is the signal, and this is the
 * only place a `use cache: private` entry can be dropped from — `updateTag`
 * runs in Server Actions and nowhere else.
 *
 * Deliberately takes no arguments and trusts nothing from the caller: it reads
 * the session server-side and clears that session's tag. A client that called
 * it in a loop would only ever expire its own inbox.
 */
export async function syncChatAction(): Promise<void> {
  const { user } = await requireUser();
  updateTag(chatTag(user.id));
  refresh();
}

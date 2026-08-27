/**
 * "The room is taken" — the wording and the rules, kept apart from the action
 * so both can be tested without a database.
 */

/** `messages.content` is capped at 2000 characters (migration 0001). */
export const TAKEN_MESSAGE_MAX = 2000;

/**
 * What every member the owner is chatting with reads. Offered as a starting
 * point, not imposed: the owner can rewrite it before it goes out.
 */
export function defaultTakenMessage(title: string): string {
  const room = title.trim();
  return room
    ? `Thanks for your interest in ${room} — the room has been taken, so it is no longer available. Good luck with your search!`
    : "Thanks for your interest — the room has been taken, so it is no longer available. Good luck with your search!";
}

/**
 * What a deleted room's chats read. The same sentence as the taken notice
 * without the part about a deal: a room can be pulled for any reason, and the
 * only thing the other side needs to know is that it is gone.
 */
export function defaultRemovedMessage(title: string): string {
  const room = title.trim();
  return room
    ? `Thanks for your interest in ${room} — it is no longer available. Good luck with your search!`
    : "Thanks for your interest — it is no longer available. Good luck with your search!";
}

/** The line under the button once the room is closed: "Marked taken on 27 August 2026". */
export function takenOnLabel(takenAt: string | null | undefined): string {
  if (!takenAt) return "";
  const when = new Date(takenAt);
  if (Number.isNaN(when.getTime())) return "";
  return `Marked taken on ${when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
}

/** "6 people will be told" / "1 person will be told" / nobody to tell. */
export function tellCountLabel(count: number): string {
  if (count <= 0) return "Nobody is waiting on this room, so no message will be sent.";
  return count === 1
    ? "1 person you are chatting with will get this in their chat."
    : `${count} people you are chatting with will get this in their chat.`;
}

export type TakenMessageProblem = "empty" | "too_long" | null;

export function checkTakenMessage(message: string): TakenMessageProblem {
  const text = message.trim();
  if (!text) return "empty";
  if (text.length > TAKEN_MESSAGE_MAX) return "too_long";
  return null;
}

export function takenMessageError(problem: TakenMessageProblem): string {
  if (problem === "empty") return "Write what you want everyone to read.";
  if (problem === "too_long") return `Keep it under ${TAKEN_MESSAGE_MAX} characters.`;
  return "";
}

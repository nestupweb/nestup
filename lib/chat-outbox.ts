import type { Message, Viewing } from "@/lib/types";

export type OutboxStatus = "sending" | "sent" | "failed";

/** A message the browser has shown before the server confirmed it. `id` doubles as the client id. */
export interface OutboxMessage extends Message {
  client_id: string;
  status: OutboxStatus;
  error?: string;
}

export type TimelineMessage = Message & { status?: OutboxStatus; error?: string };

/**
 * Server copy wins: an optimistic message disappears the moment the server
 * list contains a row with the same client id (or the id the send returned).
 * Everything stays in send order.
 */
export function mergeMessages(server: Message[], outbox: OutboxMessage[]): TimelineMessage[] {
  const known = new Set<string>();
  for (const m of server) {
    known.add(m.id);
    if (m.client_id) known.add(m.client_id);
  }
  const pending = outbox.filter((o) => !known.has(o.client_id) && !known.has(o.id));
  return [...server, ...pending].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

/** Optimistic entries the server now knows about — safe to drop (and to revoke their previews). */
export function settledClientIds(server: Message[], outbox: OutboxMessage[]): string[] {
  const known = new Set(server.flatMap((m) => (m.client_id ? [m.client_id, m.id] : [m.id])));
  return outbox.filter((o) => known.has(o.client_id) || known.has(o.id)).map((o) => o.client_id);
}

/** Why a new viewing can't be requested right now, by the open viewing's status. */
export const OPEN_VIEWING_MESSAGE = {
  confirmed: "A viewing is already scheduled in this chat — cancel it first to pick a new time.",
  proposed: "A viewing request is already waiting for approval — cancel it first to pick a new time.",
} as const;

/**
 * The viewing that blocks a new request: a pending proposal or a confirmed
 * viewing that hasn't ended yet (soonest first). One open viewing per chat.
 */
export function openViewing(viewings: Viewing[], now: number): (Viewing & { status: "proposed" | "confirmed" }) | null {
  return (
    viewings
      .filter((v): v is Viewing & { status: "proposed" | "confirmed" } =>
        (v.status === "proposed" || v.status === "confirmed") && Date.parse(v.ends_at) > now
      )
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0] ?? null
  );
}

/** Confirmed viewings that haven't ended yet, soonest first. */
export function upcomingConfirmed(viewings: Viewing[], now: number): Viewing[] {
  return viewings
    .filter((v) => v.status === "confirmed" && Date.parse(v.ends_at) > now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

export function isUpcoming(endsAt: string | null | undefined, now: number): boolean {
  return Boolean(endsAt) && Date.parse(endsAt as string) > now;
}

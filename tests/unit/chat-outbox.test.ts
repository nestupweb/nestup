import { describe, expect, test } from "vitest";
import { isUpcoming, mergeMessages, settledClientIds, upcomingConfirmed, type OutboxMessage } from "@/lib/chat-outbox";
import type { Message, Viewing } from "@/lib/types";

const msg = (id: string, at: string, extra: Partial<Message> = {}): Message => ({
  id,
  conversation_id: "c",
  sender_id: "me",
  content: `m-${id}`,
  image_path: null,
  client_id: null,
  created_at: at,
  ...extra,
});
const optimistic = (clientId: string, at: string, status: OutboxMessage["status"] = "sending"): OutboxMessage => ({
  ...msg(clientId, at),
  client_id: clientId,
  status,
});

describe("mergeMessages", () => {
  test("shows optimistic messages after the server ones, in send order", () => {
    const server = [msg("s1", "2026-08-25T10:00:00Z")];
    const out = [optimistic("c1", "2026-08-25T10:01:00Z"), optimistic("c2", "2026-08-25T10:02:00Z")];
    expect(mergeMessages(server, out).map((m) => m.id)).toEqual(["s1", "c1", "c2"]);
    expect(mergeMessages(server, out)[1].status).toBe("sending");
  });

  test("drops an optimistic copy once the server row with the same client id arrives", () => {
    const server = [msg("s1", "2026-08-25T10:00:00Z"), msg("s2", "2026-08-25T10:01:00Z", { client_id: "c1" })];
    const out = [optimistic("c1", "2026-08-25T10:01:00Z", "sent"), optimistic("c2", "2026-08-25T10:02:00Z")];
    const merged = mergeMessages(server, out);
    expect(merged.map((m) => m.id)).toEqual(["s1", "s2", "c2"]);
    expect(merged.filter((m) => m.content === "m-c1")).toHaveLength(0); // no duplicate
    expect(settledClientIds(server, out)).toEqual(["c1"]);
  });

  test("keeps a failed message visible so it can be retried", () => {
    const merged = mergeMessages([], [optimistic("c1", "2026-08-25T10:01:00Z", "failed")]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("failed");
  });
});

describe("upcomingConfirmed / isUpcoming", () => {
  const v = (id: string, status: Viewing["status"], starts: string, ends: string): Viewing => ({
    id,
    conversation_id: "c",
    proposed_by: "me",
    starts_at: starts,
    ends_at: ends,
    status,
    note: "",
    google_event_id: null,
    google_event_link: null,
    created_at: "2026-08-20T00:00:00Z",
  });
  const now = Date.parse("2026-08-25T12:00:00Z");

  test("only confirmed viewings that haven't ended count, soonest first", () => {
    const list = [
      v("later", "confirmed", "2026-09-02T10:00:00Z", "2026-09-02T10:45:00Z"),
      v("soon", "confirmed", "2026-08-26T10:00:00Z", "2026-08-26T10:45:00Z"),
      v("pending", "proposed", "2026-08-27T10:00:00Z", "2026-08-27T10:45:00Z"),
      v("cancelled", "cancelled", "2026-08-28T10:00:00Z", "2026-08-28T10:45:00Z"),
      v("past", "confirmed", "2026-08-24T10:00:00Z", "2026-08-24T10:45:00Z"),
      v("running", "confirmed", "2026-08-25T11:30:00Z", "2026-08-25T12:15:00Z"),
    ];
    expect(upcomingConfirmed(list, now).map((x) => x.id)).toEqual(["running", "soon", "later"]);
  });

  test("isUpcoming handles missing values and the boundary", () => {
    expect(isUpcoming(null, now)).toBe(false);
    expect(isUpcoming(undefined, now)).toBe(false);
    expect(isUpcoming("2026-08-25T12:00:00Z", now)).toBe(false); // ended exactly now
    expect(isUpcoming("2026-08-25T12:00:01Z", now)).toBe(true);
  });
});

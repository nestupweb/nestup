import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// Records the order of the calls that matter: the token must reach Realtime before the join.
const calls: string[] = [];
let handlers: Array<(e: unknown) => void> = [];
const channel = {
  on: vi.fn((_type: string, _filter: unknown, cb: (e: unknown) => void) => {
    handlers.push(cb);
    return channel;
  }),
  subscribe: vi.fn(() => {
    calls.push("subscribe");
    return channel;
  }),
};
const client = {
  auth: {
    getSession: vi.fn(async () => {
      calls.push("getSession");
      return { data: { session: { access_token: "jwt-123" } } };
    }),
  },
  realtime: { setAuth: vi.fn(async (token: string) => { calls.push(`setAuth:${token}`); }) },
  channel: vi.fn(() => channel),
  removeChannel: vi.fn(),
};
vi.mock("@/lib/supabase/client", () => ({ createClient: () => client }));

import { ChatRealtime } from "@/components/chat/ChatRealtime";

afterEach(() => {
  cleanup();
  calls.length = 0;
  handlers = [];
  refresh.mockClear();
  client.removeChannel.mockClear();
});

test("hands the session token to Realtime before the channel joins, then refreshes once per burst", async () => {
  const { unmount } = render(<ChatRealtime />);
  await waitFor(() => expect(calls).toContain("subscribe"));
  expect(calls).toEqual(["getSession", "setAuth:jwt-123", "subscribe"]);
  expect(channel.on).toHaveBeenCalledWith("postgres_changes", expect.objectContaining({ table: "messages" }), expect.any(Function));
  expect(channel.on).toHaveBeenCalledWith("postgres_changes", expect.objectContaining({ table: "viewings" }), expect.any(Function));

  // A message and a viewing change arriving together → a single refresh.
  for (const h of handlers) h({});
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

  unmount();
  expect(client.removeChannel).toHaveBeenCalledWith(channel);
});

test("a tab coming back into view refreshes the thread", async () => {
  render(<ChatRealtime />);
  await waitFor(() => expect(calls).toContain("subscribe"));
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
});

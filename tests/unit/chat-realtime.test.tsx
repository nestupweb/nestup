import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

/**
 * The component calls `syncChatAction`, not `router.refresh()`.
 *
 * That distinction is the whole reason the Chat inbox can be cached at all. A
 * bare router refresh re-renders the route and is handed back the same
 * `use cache: private` inbox, so a message that had just landed would not
 * appear until the stale window ran out. The action drops this member's
 * `chatTag` first and then refreshes. Asserting on the action rather than on
 * the router is what stops that regressing back to a refresh that does nothing.
 */
// `vi.hoisted`, because `vi.mock` is hoisted above every `const` in this file
// and the component imports the action at module load — so the factory runs
// before a plain top-level `const` would be initialized, and throws a TDZ
// ReferenceError. (The old `next/navigation` mock got away with a bare const
// only because it dereferenced it inside `useRouter()`, at render time.)
const { syncChatAction } = vi.hoisted(() => ({ syncChatAction: vi.fn(async () => {}) }));
vi.mock("@/app/actions/chat", () => ({ syncChatAction }));

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
  syncChatAction.mockClear();
  client.removeChannel.mockClear();
});

test("hands the session token to Realtime before the channel joins, then refreshes once per burst", async () => {
  const { unmount } = render(<ChatRealtime />);
  await waitFor(() => expect(calls).toContain("subscribe"));
  expect(calls).toEqual(["getSession", "setAuth:jwt-123", "subscribe"]);
  expect(channel.on).toHaveBeenCalledWith("postgres_changes", expect.objectContaining({ table: "messages" }), expect.any(Function));
  expect(channel.on).toHaveBeenCalledWith("postgres_changes", expect.objectContaining({ table: "viewings" }), expect.any(Function));

  // A message and a viewing change arriving together → a single invalidation.
  for (const h of handlers) h({});
  await waitFor(() => expect(syncChatAction).toHaveBeenCalledTimes(1));

  unmount();
  expect(client.removeChannel).toHaveBeenCalledWith(channel);
});

test("a tab coming back into view drops the cached inbox", async () => {
  render(<ChatRealtime />);
  await waitFor(() => expect(calls).toContain("subscribe"));
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await waitFor(() => expect(syncChatAction).toHaveBeenCalledTimes(1));
});

/**
 * A socket that drops a frame, or an action that fails, must not throw inside
 * the effect — the next event retries. Before the inbox was cached this was a
 * fire-and-forget `router.refresh()` that could not reject; now it is a server
 * action that can.
 */
test("a failing sync is swallowed rather than thrown from the effect", async () => {
  syncChatAction.mockRejectedValueOnce(new Error("offline"));
  render(<ChatRealtime />);
  await waitFor(() => expect(calls).toContain("subscribe"));
  for (const h of handlers) h({});
  await waitFor(() => expect(syncChatAction).toHaveBeenCalledTimes(1));
});

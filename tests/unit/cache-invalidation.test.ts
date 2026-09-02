// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * Blast radius of a mutation.
 *
 * Before tags, every action answered a write with a fistful of
 * `revalidatePath` calls — saving a listing rebuilt `/listing`, `/browse`,
 * `/profile`, `/swipe` AND `/chat`, so editing a room threw away the member's
 * chats too. These lock in the rule that replaced it: a write invalidates the
 * things it actually changed and nothing else.
 *
 * The specific regression guarded here is a mutation reaching into another
 * member's cache, or into a feature it has no business touching.
 */
const updateTag = vi.fn();
const refresh = vi.fn();
const requireUser = vi.fn();
const rpc = vi.fn();
const upsert = vi.fn();
const del = vi.fn();
const respondToInvite = vi.fn();

// Spied by hand rather than taken from the shared stub: these tests assert on
// the exact set of tags each mutation invalidates, so they need the reference.
vi.mock("next/cache", () => ({
  updateTag,
  refresh,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser }));
vi.mock("@/lib/invites", () => ({ respondToInvite, searchAvailableMembers: vi.fn() }));
vi.mock("@/lib/chat", () => ({
  markConversationRead: vi.fn(),
  clearConversation: vi.fn(async () => true),
  findOrCreateConversation: vi.fn(),
  getConversations: vi.fn(),
  visibleConversations: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const ME = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";
const CHAT = "33333333-3333-4333-8333-333333333333";
const MESSAGE = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  updateTag.mockReset();
  refresh.mockReset();
  rpc.mockReset().mockResolvedValue({ data: 1, error: null });
  upsert.mockReset().mockResolvedValue({ error: null });
  del.mockReset().mockResolvedValue({ error: null });
  respondToInvite.mockReset().mockResolvedValue({ listingId: ROOM });
  requireUser.mockReset().mockResolvedValue({
    user: { id: ME, email: "me@nestup.dev" },
    supabase: {
      rpc,
      from: () => ({
        upsert,
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: { id: MESSAGE, conversation_id: CHAT, content: "hi" },
              error: null,
            }),
          }),
        }),
        delete: () => ({ eq: () => ({ eq: del }) }),
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        }),
      }),
    },
  });
});

/** Every tag the action asked to invalidate. */
const tags = () => updateTag.mock.calls.map((c) => String(c[0]));

test("hearting a room touches only that member's own two caches", async () => {
  const { setSavedAction } = await import("@/app/actions/saved");
  await setSavedAction(ROOM, true);

  expect(tags()).toEqual([`saved:${ME}`, `profile:${ME}`]);
});

test("a heart never invalidates the shared room list — it changed no room", async () => {
  const { setSavedAction } = await import("@/app/actions/saved");
  await setSavedAction(ROOM, true);

  expect(tags()).not.toContain("listings");
});

test("swiping drops the member's deck so the room cannot come back", async () => {
  const { recordSwipeAction } = await import("@/app/actions/swipe");
  await recordSwipeAction(ROOM, "skip");

  expect(tags()).toContain(`deck:${ME}`);
});

/**
 * Chat has a cache of its own now (`chatTag`), but it stays Chat's: no listing
 * mutation may reach into it. Hearting a room or swiping is not a reason to
 * throw away the member's inbox — that blanket invalidation was the behaviour
 * that made an unrelated tab reload.
 */
test("no listing mutation reaches into chat", async () => {
  const { setSavedAction } = await import("@/app/actions/saved");
  const { recordSwipeAction } = await import("@/app/actions/swipe");

  await setSavedAction(ROOM, true);
  await recordSwipeAction(ROOM, "like");

  for (const tag of tags()) {
    expect(tag).not.toMatch(/chat|conversation|message/i);
  }
});

/**
 * Every per-member tag carries the member's own id. A tag that forgot it would
 * be one shared cache key for the whole app — the exact shape of a cross-user
 * leak — so this asserts the id is present rather than trusting the helpers.
 */
test("every per-member tag is scoped to the member who acted", async () => {
  const { setSavedAction } = await import("@/app/actions/saved");
  const { recordSwipeAction } = await import("@/app/actions/swipe");

  await setSavedAction(ROOM, true);
  await recordSwipeAction(ROOM, "like");

  const personal = tags().filter((t) => /^(saved|profile|deck):/.test(t));
  expect(personal.length).toBeGreaterThan(0);
  for (const tag of personal) expect(tag.endsWith(`:${ME}`)).toBe(true);
});

/**
 * `refreshEverywhere` — the worst of the old sweeps. Answering one invite
 * rebuilt /profile, /browse, /browse/[id], /swipe AND /chat, and because
 * `revalidatePath` inside a Server Action also expires every page the member
 * had already visited, saying yes to a roommate emptied their whole session
 * cache. It changes their own profile and the room's household; that is all.
 */
test("answering an invite touches the member's profile and the room, nothing else", async () => {
  const { respondToInviteAction } = await import("@/app/actions/co-posters");
  const form = new FormData();
  form.set("invite_id", "55555555-5555-4555-8555-555555555555");
  form.set("answer", "yes");

  await respondToInviteAction({}, form);

  expect(tags()).toEqual([`profile:${ME}`, `listing:${ROOM}`]);
});

test("answering an invite never reaches into chat or the shared room list", async () => {
  const { respondToInviteAction } = await import("@/app/actions/co-posters");
  const form = new FormData();
  form.set("invite_id", "55555555-5555-4555-8555-555555555555");
  form.set("answer", "no");

  await respondToInviteAction({}, form);

  expect(tags()).not.toContain("listings");
  for (const tag of tags()) expect(tag).not.toMatch(/chat|conversation|message/i);
});

/** Pausing a room is the same change as editing one, so it drops the same four. */
test("pausing a room drops the public list, the room, and the owner's own caches", async () => {
  const { setListingActiveAction } = await import("@/app/actions/settings");
  await setListingActiveAction(ROOM, false);

  expect(tags()).toEqual(["listings", `listing:${ROOM}`, `profile:${ME}`, `deck:${ME}`]);
});

/**
 * The other half of the rule. Sending a message expires the sender's own inbox
 * — it moved the thread to the top of the list and changed its preview line —
 * and nothing else. Swipe, Listings and Profile are left exactly as they were,
 * which is what `revalidatePath("/chat")` could not do: in a Server Action it
 * forced every visited page to refetch on its next visit.
 *
 * This test used to assert the opposite (`tags()` empty), because the inbox was
 * uncached and there was nothing to clear. Caching it is what bought Chat its
 * instant return; this is the invalidation that keeps it honest.
 */
test("sending a message drops the sender's own inbox and nothing else", async () => {
  const { sendMessageAction } = await import("@/app/actions/chat");
  const result = await sendMessageAction({
    conversationId: CHAT,
    clientId: MESSAGE,
    content: "hello",
  });

  expect(result.ok).toBe(true);
  expect(tags()).toEqual([`chat:${ME}`]);
  expect(refresh).toHaveBeenCalledTimes(1);
});

/**
 * A message changes the *recipient's* inbox too, and no action of theirs runs
 * for it. That gap is covered by their own browser calling `syncChatAction`
 * off the realtime socket — which must clear their tag and no one else's.
 * A sender who could expire another member's cache from their own write would
 * be a cross-user reach, which is exactly what the tags exist to prevent.
 */
test("the realtime sync clears only the caller's own inbox", async () => {
  const { syncChatAction } = await import("@/app/actions/chat");
  await syncChatAction();

  expect(tags()).toEqual([`chat:${ME}`]);
  expect(refresh).toHaveBeenCalledTimes(1);
});

/** Opening a thread clears its unread count, which lives on the cached row. */
test("marking a thread read drops the inbox that carries its unread count", async () => {
  const { markReadAction } = await import("@/app/actions/chat");
  await markReadAction(CHAT);

  expect(tags()).toEqual([`chat:${ME}`]);
});

/** Deleting a chat removes a row from the cached list, so the list has to go. */
test("deleting a chat drops the cached inbox holding it", async () => {
  const { deleteConversationAction } = await import("@/app/actions/chat");
  const result = await deleteConversationAction(CHAT);

  expect(result.ok).toBe(true);
  expect(tags()).toEqual([`chat:${ME}`]);
});

/**
 * The scoping rule from above, extended to the tag added for Chat. `chat:` is
 * per-member like `deck:`, `profile:` and `saved:` — a tag that forgot the id
 * would be one shared key for every inbox in the app.
 */
test("the chat tag is scoped to the member who acted", async () => {
  const { syncChatAction } = await import("@/app/actions/chat");
  await syncChatAction();

  for (const tag of tags()) expect(tag).toBe(`chat:${ME}`);
  expect(tags().every((t) => t.endsWith(`:${ME}`))).toBe(true);
});

/**
 * And the converse of "no listing mutation reaches into chat": a chat mutation
 * must not reach into Swipe, Listings or Profile either. Sending a message is
 * no reason to rebuild a deck.
 */
test("a chat mutation never touches the deck, the room list or the profile", async () => {
  const { sendMessageAction } = await import("@/app/actions/chat");
  await sendMessageAction({ conversationId: CHAT, clientId: MESSAGE, content: "hello" });

  for (const tag of tags()) expect(tag).not.toMatch(/^(deck|profile|saved|listing|listings)/);
});

/** Blocking removes their rooms from the deck — and touches nothing shared. */
test("blocking a member drops only the blocker's own deck", async () => {
  const { blockUserAction } = await import("@/app/actions/moderation");
  const form = new FormData();
  form.set("blocked_id", "66666666-6666-4666-8666-666666666666");

  await blockUserAction({}, form);

  expect(tags()).toEqual([`deck:${ME}`]);
  expect(tags()).not.toContain("listings");
});

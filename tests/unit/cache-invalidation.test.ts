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
const requireUser = vi.fn();
const rpc = vi.fn();
const upsert = vi.fn();
const del = vi.fn();

vi.mock("next/cache", () => ({ updateTag, revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const ME = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  updateTag.mockReset();
  rpc.mockReset().mockResolvedValue({ data: 1, error: null });
  upsert.mockReset().mockResolvedValue({ error: null });
  del.mockReset().mockResolvedValue({ error: null });
  requireUser.mockReset().mockResolvedValue({
    user: { id: ME, email: "me@nestup.dev" },
    supabase: {
      rpc,
      from: () => ({
        upsert,
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
 * The whole point of the change. Chat has its own tag-free, always-fresh
 * reads, and no listing mutation may invalidate it — that was the behaviour
 * that made an unrelated tab reload.
 */
test("no mutation reaches into chat", async () => {
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

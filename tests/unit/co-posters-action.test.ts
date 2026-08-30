// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

/**
 * The write path for shared listings is one RPC each way, and every rule lives
 * in migration 0032. These cover what the TypeScript is responsible for:
 * refusing junk before it reaches the database, passing exactly what the
 * function expects, and turning its refusals into something a member can read.
 */
const rpc = vi.hoisted(() => vi.fn());
const blocked = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ user: { id: "me-1" }, supabase: { rpc } }),
}));
vi.mock("@/lib/moderation", () => ({ getBlockedIds: blocked }));
vi.mock("next/cache", async () => await import("../helpers/next-cache-stub"));

const INVITE = "33333333-3333-4333-8333-333333333333";
const LISTING = "22222222-2222-4222-8222-222222222222";
const A = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  rpc.mockReset();
  blocked.mockReset();
  blocked.mockResolvedValue(new Set<string>());
});

function answerForm(inviteId: string, answer: string): FormData {
  const form = new FormData();
  form.set("invite_id", inviteId);
  form.set("answer", answer);
  return form;
}

test("Yes calls the database with the invite id and an affirmative", async () => {
  rpc.mockResolvedValue({ data: LISTING, error: null });
  const { respondToInviteAction } = await import("@/app/actions/co-posters");

  expect(await respondToInviteAction({}, answerForm(INVITE, "yes"))).toEqual({ answered: "yes" });
  expect(rpc).toHaveBeenCalledWith("respond_to_listing_invite", { p_invite: INVITE, p_accept: true });
});

test("No is the same call with the answer flipped", async () => {
  rpc.mockResolvedValue({ data: LISTING, error: null });
  const { respondToInviteAction } = await import("@/app/actions/co-posters");

  expect(await respondToInviteAction({}, answerForm(INVITE, "no"))).toEqual({ answered: "no" });
  expect(rpc).toHaveBeenCalledWith("respond_to_listing_invite", { p_invite: INVITE, p_accept: false });
});

test("an answer that is neither yes nor no never reaches the database", async () => {
  const { respondToInviteAction } = await import("@/app/actions/co-posters");

  const result = await respondToInviteAction({}, answerForm(INVITE, "maybe"));
  expect(result.error).toMatch(/could not tell which answer/i);
  expect(rpc).not.toHaveBeenCalled();
});

test("a forged invite id is refused before the database is asked", async () => {
  const { respondToInviteAction } = await import("@/app/actions/co-posters");

  const result = await respondToInviteAction({}, answerForm("' or 1=1 --", "yes"));
  expect(result.error).toMatch(/could not tell which invitation/i);
  expect(rpc).not.toHaveBeenCalled();
});

test("answering twice is reported in the card's own words", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "this invite was already answered" } });
  const { respondToInviteAction } = await import("@/app/actions/co-posters");

  const result = await respondToInviteAction({}, answerForm(INVITE, "yes"));
  expect(result.error).toMatch(/already answered/i);
  expect(result.answered).toBeUndefined();
});

test("answering somebody else's invitation is refused by the database, not by us", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "only the invited member may answer this" } });
  const { respondToInviteAction } = await import("@/app/actions/co-posters");

  expect((await respondToInviteAction({}, answerForm(INVITE, "yes"))).error).toMatch(/isn’t yours to answer/i);
});

test("the member search skips the round-trip until there is enough to search for", async () => {
  const { searchMembersAction } = await import("@/app/actions/co-posters");
  expect(await searchMembersAction("m")).toEqual({ members: [] });
  expect(await searchMembersAction("   ")).toEqual({ members: [] });
});

test("tagging passes a de-duplicated id list to the reconciling function", async () => {
  rpc.mockResolvedValue({ data: 2, error: null });
  const { inviteRoommates } = await import("@/lib/invites");

  const result = await inviteRoommates({ rpc } as never, LISTING, [A, A.toUpperCase(), "junk", ""]);

  expect(result).toEqual({ pending: 2 });
  expect(rpc).toHaveBeenCalledWith("invite_listing_roommates", { p_listing: LISTING, p_invitees: [A] });
});

test("clearing every tag sends an empty list rather than skipping the call", async () => {
  rpc.mockResolvedValue({ data: 0, error: null });
  const { inviteRoommates } = await import("@/lib/invites");

  await inviteRoommates({ rpc } as never, LISTING, []);
  expect(rpc).toHaveBeenCalledWith("invite_listing_roommates", { p_listing: LISTING, p_invitees: [] });
});

test("going over the cap comes back as a sentence and a 422", async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: "at most 2 roommate(s) can be tagged when there are 3 current roommates" },
  });
  const { inviteRoommates } = await import("@/lib/invites");

  const result = await inviteRoommates({ rpc } as never, LISTING, [A]);
  expect(result.error).toMatch(/more roommates than there are rooms/i);
  expect(result.status).toBe(422);
});

test("tagging a blocked member is refused with a 403", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "cannot tag a blocked member" } });
  const { inviteRoommates } = await import("@/lib/invites");

  const result = await inviteRoommates({ rpc } as never, LISTING, [A]);
  expect(result.error).toMatch(/blocked/i);
  expect(result.status).toBe(403);
});

/**
 * One person, one home (0033). The three rules — name, blocks, housing — live
 * in `search_available_members` (0034) so they run BEFORE the limit; filtering a
 * capped page in TypeScript showed two people where four matched.
 */
test("the search asks the database for available members only", async () => {
  rpc.mockResolvedValue({
    data: [{ user_id: A, full_name: "Barak Shapira", avatar_url: null, occupation: "Vet" }],
    error: null,
  });
  const { searchMembersAction } = await import("@/app/actions/co-posters");

  const { members } = await searchMembersAction("bar", LISTING);

  expect(members).toHaveLength(1);
  expect(members[0].full_name).toBe("Barak Shapira");
  expect(rpc).toHaveBeenCalledWith("search_available_members", {
    p_query: "bar",
    p_listing: LISTING,
    p_limit: 8,
  });
});

test("the room being edited is passed through, so its own roommates stay offerable", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  const { searchMembersAction } = await import("@/app/actions/co-posters");

  await searchMembersAction("noa", LISTING);
  expect(rpc.mock.calls[0][1].p_listing).toBe(LISTING);

  // A junk listing id must not be forwarded as a filter.
  rpc.mockClear();
  await searchMembersAction("noa", "not-a-uuid");
  expect(rpc.mock.calls[0][1].p_listing).toBeNull();
});

test("a failed search is an empty list, never a thrown page", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
  const { searchMembersAction } = await import("@/app/actions/co-posters");
  expect(await searchMembersAction("bar")).toEqual({ members: [] });
});

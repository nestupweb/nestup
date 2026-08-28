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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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
 * One person, one home (0033). `getBusyMemberIds` is what keeps the picker from
 * offering someone the database would then refuse.
 */
function housingClient(ownerRows: unknown[], residentRows: unknown[]) {
  const chain = (rows: unknown[]) => {
    const node: Record<string, unknown> = {};
    for (const m of ["select", "in", "eq"]) node[m] = () => node;
    node.is = async () => ({ data: rows, error: null });
    return node;
  };
  return {
    from: (table: string) => chain(table === "listings" ? ownerRows : residentRows),
  } as never;
}

test("a member who owns a live listing is unavailable", async () => {
  const { getBusyMemberIds } = await import("@/lib/invites");
  const busy = await getBusyMemberIds(housingClient([{ owner_id: A }], []), [A, INVITE]);
  expect([...busy]).toEqual([A]);
});

test("a member who already confirmed another home is unavailable", async () => {
  const { getBusyMemberIds } = await import("@/lib/invites");
  const busy = await getBusyMemberIds(
    housingClient([], [{ resident_id: A, listing_id: "other-listing" }]),
    [A]
  );
  expect(busy.has(A)).toBe(true);
});

test("this room's own confirmed roommates stay available to it", async () => {
  const { getBusyMemberIds } = await import("@/lib/invites");
  // Without `exceptListing`, re-saving a form would report every roommate who
  // had already joined it as housed elsewhere.
  const busy = await getBusyMemberIds(
    housingClient([], [{ resident_id: A, listing_id: LISTING }]),
    [A],
    LISTING
  );
  expect(busy.size).toBe(0);
});

test("nobody to check means no round-trip", async () => {
  const { getBusyMemberIds } = await import("@/lib/invites");
  const exploding = { from: () => { throw new Error("should not query"); } } as never;
  expect((await getBusyMemberIds(exploding, [])).size).toBe(0);
});

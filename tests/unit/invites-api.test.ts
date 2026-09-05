// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The co-poster invitation API: `GET /api/invites` and `PATCH /api/invites/:id`.
 *
 * These are the only Route Handlers in the app that write, and the only ones
 * that require a session — Listings is public and its handlers are anonymous
 * by design. Three things therefore have to hold, and none of them is visible
 * from the UI tests that drive the same flow through the Server Action:
 *
 *  1. **No session, no answer.** The middleware guards *page* routes only; an
 *     API caller must get a JSON 401 rather than an HTML redirect, and the
 *     handler is the only thing that can produce one.
 *  2. **A malformed request is a 400, not a 500.** The body arrives as
 *     whatever the caller sent — `request.json()` on an empty or non-JSON
 *     body throws, and an unguarded throw here is a 500 for a typo.
 *  3. **The database's own refusals keep their status.** Answering an
 *     invitation twice is a 409 from `respond_to_listing_invite`, and turning
 *     that into a flat 400 would lose the one thing the caller can act on.
 *
 * The authorisation itself is not here and must not be: `respond_to_listing_invite`
 * (migration 0032) checks the caller is the invitee, inside the transaction
 * that writes the answer. This handler only carries the answer back out.
 */

const getAuthContext = vi.fn();
const getPendingInvites = vi.fn();
const respondToInvite = vi.fn();

vi.mock("@/lib/auth", () => ({ getAuthContext }));
vi.mock("@/lib/invites", () => ({ getPendingInvites, respondToInvite }));

const ME = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";
const INVITE = "44444444-4444-4444-8444-444444444444";

const supabase = { from: vi.fn(), rpc: vi.fn() };

beforeEach(() => {
  getAuthContext.mockReset().mockResolvedValue({ supabase, user: { id: ME } });
  getPendingInvites.mockReset().mockResolvedValue([]);
  respondToInvite.mockReset().mockResolvedValue({ listingId: ROOM });
});

async function patch(body: unknown, id = INVITE) {
  const { NextRequest } = await import("next/server");
  const { PATCH } = await import("@/app/api/invites/[id]/route");
  const request = new NextRequest(`http://localhost:3000/api/invites/${id}`, {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  const response = await PATCH(request, { params: Promise.resolve({ id }) });
  return { response, body: await response.json() };
}

describe("GET /api/invites", () => {
  test("a visitor gets a JSON 401, not an HTML redirect", async () => {
    getAuthContext.mockResolvedValue({ supabase, user: null });
    const { GET } = await import("@/app/api/invites/route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in first." });
    expect(getPendingInvites).not.toHaveBeenCalled();
  });

  /**
   * There is no id to pass and none to forge: RLS shows a member only their
   * own rows, so the handler asks for "mine" and nothing else.
   */
  test("the member's own unanswered invitations come back, trimmed to what a card shows", async () => {
    getPendingInvites.mockResolvedValue([
      {
        id: INVITE,
        listing: { id: ROOM, title: "Sunlit room", city: "Tel Aviv", rent: 2800, description: "secret notes" },
        inviter: { user_id: "o1", full_name: "Noa", avatar_url: null },
      },
    ]);
    const { GET } = await import("@/app/api/invites/route");
    const { invites } = await (await GET()).json();

    expect(getPendingInvites).toHaveBeenCalledWith(supabase, ME);
    expect(invites).toEqual([
      {
        id: INVITE,
        listing: { id: ROOM, title: "Sunlit room", city: "Tel Aviv", rent: 2800 },
        inviter: { user_id: "o1", full_name: "Noa", avatar_url: null },
      },
    ]);
    // The whole listing row is fetched but only four fields are published.
    expect(invites[0].listing).not.toHaveProperty("description");
  });

  test("no invitations is an empty list, not an error", async () => {
    const { GET } = await import("@/app/api/invites/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ invites: [] });
  });
});

describe("PATCH /api/invites/:id", () => {
  test("a visitor gets a JSON 401 and the answer is never attempted", async () => {
    getAuthContext.mockResolvedValue({ supabase, user: null });
    const { response, body } = await patch({ status: "accepted" });

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Sign in first." });
    expect(respondToInvite).not.toHaveBeenCalled();
  });

  test("Yes writes an acceptance and answers with the room it joined", async () => {
    const { response, body } = await patch({ status: "accepted" });

    expect(response.status).toBe(200);
    expect(respondToInvite).toHaveBeenCalledWith(supabase, INVITE, true);
    expect(body).toEqual({ id: INVITE, status: "accepted", listing_id: ROOM });
  });

  test("No is the same call with the answer flipped", async () => {
    respondToInvite.mockResolvedValue({ listingId: undefined });
    const { response, body } = await patch({ status: "declined" });

    expect(response.status).toBe(200);
    expect(respondToInvite).toHaveBeenCalledWith(supabase, INVITE, false);
    expect(body).toMatchObject({ status: "declined" });
  });

  test.each([
    ["a body that isn't JSON at all", "not json", "Expected a JSON body."],
    ["a body with no status", { note: "yes please" }, 'Expected `status` to be "accepted" or "declined".'],
    ["a status nobody offered", { status: "maybe" }, 'Expected `status` to be "accepted" or "declined".'],
    ["a status that is the right word in the wrong case", { status: "Accepted" }, 'Expected `status` to be "accepted" or "declined".'],
  ])("%s is a 400 with a sentence, never a 500", async (_label, body, message) => {
    const result = await patch(body);

    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: message });
    expect(respondToInvite).not.toHaveBeenCalled();
  });

  /**
   * `respond_to_listing_invite` raises on an invitation that was already
   * answered, on one addressed to somebody else, and on an id that is not one.
   * Each arrives here with the status the caller should see.
   */
  test.each([
    ["answering twice", 409, "You have already answered this invitation."],
    ["somebody else's invitation", 403, "That invitation isn't yours to answer."],
    ["an invitation that isn't one", 400, "Could not tell which invitation that was."],
  ])("%s keeps the status the database chose", async (_label, status, error) => {
    respondToInvite.mockResolvedValue({ error, status });
    const result = await patch({ status: "accepted" });

    expect(result.response.status).toBe(status);
    expect(result.body).toEqual({ error });
  });

  test("a refusal with no status of its own still answers 400 rather than 200", async () => {
    respondToInvite.mockResolvedValue({ error: "Something went wrong." });
    const result = await patch({ status: "accepted" });

    expect(result.response.status).toBe(400);
  });
});

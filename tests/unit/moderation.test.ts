// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reporting, blocking and suspension. The rules themselves live in migrations
 * 0029/0030 and are enforced by RLS and a trigger — these cover the seams the
 * app owns: what the actions do with the database's answers, that a suspended
 * account cannot sign in, and that blocked members leave the deck.
 */

const insert = vi.fn();
const del = vi.fn();
const rpc = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();

/** Minimal chainable PostgREST stand-in: every filter returns `this`. */
function table() {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle,
    insert,
    delete: del,
  };
  return chain;
}

const supabase = {
  from: vi.fn(() => table()),
  rpc,
  auth: { signInWithPassword, signOut, getUser: vi.fn() },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ supabase, user: { id: "me-0000", email: "me@nestup.dev" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null });
  del.mockReset().mockReturnValue({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) });
  rpc.mockReset().mockResolvedValue({ data: [], error: null });
  maybeSingle.mockReset().mockResolvedValue({ data: null });
  signInWithPassword.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const OTHER = "11111111-2222-3333-4444-555555555555";

describe("reporting", () => {
  test("a report needs a reason", async () => {
    const { reportUserAction } = await import("@/app/actions/moderation");
    const state = await reportUserAction({}, form({ reported_id: OTHER, reason: "" }));
    expect(state.error).toMatch(/reason/i);
    expect(insert).not.toHaveBeenCalled();
  });

  test("an unknown reason never reaches the database", async () => {
    const { reportUserAction } = await import("@/app/actions/moderation");
    const state = await reportUserAction({}, form({ reported_id: OTHER, reason: "because-i-say-so" }));
    expect(state.error).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  test("details are optional and travel as null when blank", async () => {
    const { reportUserAction } = await import("@/app/actions/moderation");
    const state = await reportUserAction({}, form({ reported_id: OTHER, reason: "spam", details: "   " }));
    expect(state.done).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ reported_id: OTHER, reason: "spam", details: null }));
  });

  test("a second report by the same member is accepted but never counted again", async () => {
    // 23505 = the unique (reporter_id, reported_id) constraint from 0029.
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const { reportUserAction } = await import("@/app/actions/moderation");
    const state = await reportUserAction({}, form({ reported_id: OTHER, reason: "harassment" }));
    expect(state.done).toBe(true);
    expect(state.error).toBeUndefined();
  });

  test("you cannot report yourself", async () => {
    const { reportUserAction } = await import("@/app/actions/moderation");
    const state = await reportUserAction({}, form({ reported_id: "me-0000", reason: "spam" }));
    expect(state.error).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("blocking", () => {
  test("blocking twice is not an error", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const { blockUserAction } = await import("@/app/actions/moderation");
    const state = await blockUserAction({}, form({ blocked_id: OTHER }));
    expect(state.done).toBe(true);
  });

  test("you cannot block yourself", async () => {
    const { blockUserAction } = await import("@/app/actions/moderation");
    const state = await blockUserAction({}, form({ blocked_id: "me-0000" }));
    expect(state.error).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  test("a malformed id is refused before the database", async () => {
    const { unblockUserAction } = await import("@/app/actions/moderation");
    const state = await unblockUserAction({}, form({ blocked_id: "not-a-uuid" }));
    expect(state.error).toBeTruthy();
  });
});

describe("suspension blocks sign-in", () => {
  test("right password + suspended account = refused, signed out, exact wording", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "susp-1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { user_id: "susp-1" } });

    const { signInAction } = await import("@/app/actions/auth");
    const { SUSPENDED_MESSAGE } = await import("@/lib/moderation");
    const state = await signInAction({}, form({ email: "susp@nestup.dev", password: "goodpassword" }));

    expect(state.error).toBe("Your account has been suspended due to improper use of the platform.");
    expect(state.error).toBe(SUSPENDED_MESSAGE);
    expect(signOut).toHaveBeenCalled();
  });

  test("an account with no suspension row signs in as usual", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "ok-1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: null });

    const { signInAction } = await import("@/app/actions/auth");
    await expect(signInAction({}, form({ email: "ok@nestup.dev", password: "goodpassword" }))).rejects.toThrow(
      /REDIRECT:/
    );
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("the migration keeps its promises", () => {
  const sql = (name: string) =>
    readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8").replace(/\r\n/g, "\n");

  test("suspensions has a read policy and no write policy at all", () => {
    const text = sql("0029_reports_blocks_suspension.sql");
    const policies = [...text.matchAll(/create policy "[^"]+" on public\.suspensions for (\w+)/g)].map((m) => m[1]);
    expect(policies).toEqual(["select"]);
  });

  test("one report per reporter per subject is a database constraint, not app logic", () => {
    expect(sql("0029_reports_blocks_suspension.sql")).toMatch(/unique \(reporter_id, reported_id\)/);
  });

  test("inappropriate images suspend without waiting for the threshold", () => {
    const text = sql("0029_reports_blocks_suspension.sql");
    expect(text).toMatch(/if new\.reason = 'inappropriate_images' then/);
    // The immediate arm comes before the count test, so the threshold can't gate it.
    expect(text.indexOf("if new.reason = 'inappropriate_images'")).toBeLessThan(text.indexOf("reporters >= threshold"));
  });

  test("the threshold is a row that can be tuned, not a literal in the trigger", () => {
    const text = sql("0029_reports_blocks_suspension.sql");
    expect(text).toMatch(/from public\.app_config where key = 'report_suspend_threshold'/);
  });

  test("sending a message checks both the block and the suspension", () => {
    const text = sql("0029_reports_blocks_suspension.sql");
    const policy = text.slice(text.indexOf('create policy "participants send conversation messages"'));
    expect(policy).toMatch(/not public\.conversation_has_block\(conversation_id\)/);
    expect(policy).toMatch(/not public\.is_suspended\(/);
  });

  test("the 'linked to this room' exception cannot be used to see past a block", () => {
    // 0027 added a second PERMISSIVE select policy on listings; permissive
    // policies are OR'd, so it silently re-granted what 0030 had taken away.
    // Caught by probing the live database, fixed in 0031.
    const text = sql("0031_block_beats_linked_listing.sql");
    expect(text).toMatch(/not public\.is_suspended\(owner_id\)/);
    expect(text).toMatch(/not public\.is_blocked\(\(select auth\.uid\(\)\), owner_id\)/);
    // ...but a room you actually live in stays readable even so.
    expect(text).toMatch(/listing_residents r[\s\S]*resident_id = \(select auth\.uid\(\)\)/);
  });

  test("blocked and suspended members' rooms are hidden by the listings policy itself", () => {
    const text = sql("0030_hide_blocked_and_suspended.sql");
    expect(text).toMatch(/not public\.is_suspended\(owner_id\)/);
    expect(text).toMatch(/not public\.is_blocked\(\(select auth\.uid\(\)\), owner_id\)/);
  });
});

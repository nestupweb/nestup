// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Logging out has to empty this browser, not just end the session.
 *
 * Four tabs are now served from caches that live in the member's own browser:
 * the `use cache: private` entries (deck, profile tabs, saved room ids, chat
 * inbox) and the router's cache of already-rendered pages for /swipe, /browse,
 * /chat and /profile. The second one is not keyed by member, and
 * `staleTimes.dynamic` holds it for five minutes.
 *
 * A Server Action's `redirect()` is a *soft* navigation — the client survives
 * it, and so does everything in those caches. Only a real document load tears
 * them down, which is why signing out is a form post to a Route Handler that
 * answers 303. These tests pin that shape, because it is invisible in the UI:
 * the button looks identical either way, and the regression would be private
 * data sitting in a signed-out tab.
 */
const signOut = vi.fn();
const cookiesSet = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: {
    cookies: { setAll: (c: { name: string; value: string; options?: object }[]) => void };
  }) => ({
    auth: {
      signOut: async () => {
        // Real `signOut` expires the auth cookies through this adapter.
        opts.cookies.setAll([{ name: "sb-access-token", value: "", options: { maxAge: 0 } }]);
        return signOut();
      },
    },
  }),
}));

beforeEach(() => {
  signOut.mockReset().mockResolvedValue({ error: null });
  cookiesSet.mockReset();
});

async function post() {
  const { POST } = await import("@/app/auth/signout/route");
  return POST(new NextRequest("https://nestup.test/auth/signout", { method: "POST" }));
}

test("signing out ends the session and answers a real redirect to the home page", async () => {
  const res = await post();

  expect(signOut).toHaveBeenCalledTimes(1);
  expect(new URL(res.headers.get("location")!).pathname).toBe("/");
});

/**
 * 303 specifically. A 307 would replay the POST against `/`, and — more to the
 * point — the status is what makes the browser perform a top-level document
 * navigation instead of the soft transition a Server Action would have done.
 * That navigation IS the cache clearing; there is no `next/cache` call that
 * reaches into a browser's memory.
 */
test("the redirect is a 303, so the POST becomes a GET and the document reloads", async () => {
  const res = await post();
  expect(res.status).toBe(303);
});

/** The auth cookies must be expired on this very response, not left to inference. */
test("the session cookies are cleared on the redirect response itself", async () => {
  const res = await post();
  const cookie = res.cookies.get("sb-access-token");
  expect(cookie).toBeDefined();
  expect(cookie?.value).toBe("");
});

/**
 * GET must not exist. A logout on GET can be fired by any third-party page with
 * an `<img src>`, which is a nuisance rather than a breach, but there is no
 * reason to accept it: the button is a form post.
 */
test("there is no GET handler — logout cannot be triggered by a cross-site image", async () => {
  const mod = await import("@/app/auth/signout/route");
  expect("GET" in mod).toBe(false);
});

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Log out — and, just as importantly, throw away everything this browser is
 * still holding about the member.
 *
 * Why a Route Handler rather than the Server Action this used to be. Now that
 * the four tabs are cached, signing out has to clear two client-side stores
 * that the action could not touch:
 *
 *  - the `use cache: private` entries (deck, profile tabs, saved ids, inbox),
 *    which live in the browser's memory and, per Next's own description, "do
 *    not persist across page reloads";
 *  - the router cache of rendered RSC payloads for /swipe, /browse, /chat and
 *    /profile, which — unlike the caches above — is NOT keyed by member. This
 *    is the one that actually matters, and `staleTimes.dynamic` now holds it
 *    for five minutes rather than thirty seconds.
 *
 * `redirect()` inside a Server Action is a *soft* navigation: the router stays
 * alive, and so does everything in it. The member saw a signed-out page with
 * their own deck and inbox still sitting in memory behind it, one back-button
 * press from being shown again — and the next person to sign in on that tab
 * inherited the tab in that state. A 303 from here is a real document
 * navigation, which tears the whole client down and rebuilds it empty. That is
 * the only thing that genuinely clears these caches; nothing in `next/cache`
 * reaches into another session's browser memory.
 *
 * POST-only on purpose: a GET would let any page log a member out with an
 * `<img>` tag. The session cookie is SameSite=Lax, so a cross-site POST does
 * not carry it and this is a no-op for anyone but the member themselves.
 * Being a plain form post, it also works with JavaScript disabled.
 */
export async function POST(request: NextRequest) {
  // The cookie adapter writes onto the response we are about to return, rather
  // than through `cookies()` from `next/headers`. Same pattern as
  // `lib/supabase/middleware.ts`, and for the same reason: the deletions have
  // to be on *this* redirect response, not merged into it by inference.
  const response = NextResponse.redirect(new URL("/", request.url), {
    // 303, not 307: the redirect must turn this POST into a GET of the home page.
    status: 303,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Ends the session server-side and expires the auth cookies on `response`.
  await supabase.auth.signOut();

  return response;
}

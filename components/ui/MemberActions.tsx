import { SettingsLink } from "@/components/ui/GearIcon";

/**
 * The gear and Log out pair in the site header — what a signed-in member gets
 * beside the theme toggle on every page, Listings included (2026-08-30).
 *
 * It lives here rather than in either layout because both groups render it: the
 * `(app)` header shows it outright (every page there is behind the proxy's auth
 * gate), while `(public)` can only show it once it knows there is a session, so
 * it renders this inside its `<Suspense>`. One component, so the two headers
 * cannot drift apart.
 */
export function MemberActions() {
  return (
    <>
      <SettingsLink />
      {/* Posts to a Route Handler, not a Server Action. A server action's
          `redirect()` is a soft navigation, which leaves this browser's
          `use cache: private` entries and its router cache of already-rendered
          pages alive after the session ends — see `app/auth/signout/route.ts`.
          A form post that answers 303 is a real document load, and that is what
          empties them. Markup and classes are unchanged. */}
      <form action="/auth/signout" method="post">
        {/* Hover matches the gear beside it and Edit Profile: border and label
            both go to --accent (green on light, gold on dark). */}
        <button className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent">
          Log out
        </button>
      </form>
    </>
  );
}

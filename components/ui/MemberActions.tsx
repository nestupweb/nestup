import { SettingsLink } from "@/components/ui/GearIcon";
import { signOutAction } from "@/app/actions/auth";

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
      <form action={signOutAction}>
        <button className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted hover:text-ink">
          Log out
        </button>
      </form>
    </>
  );
}

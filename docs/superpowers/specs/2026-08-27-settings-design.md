# Settings — design

**Date:** 2026-08-27
**Status:** approved by the user, both phases in scope

A signed-in member has no home for account-level controls. Changing a password
is only reachable by asking for a "forgot password" e-mail; contact details are
visible to every signed-in member with no opt-out (migration 0020); there is no
way to close an account; and nothing in the app e-mails a member about rooms.
This spec adds a Settings page that covers all four.

Out of scope: theme (stays in the header toggle), language, currency.

## 1. Entry point

A gear icon in the signed-in header, **between the theme toggle and Log out**:
`[◐ theme] [⚙] [Log out]`.

- `components/ui/GearIcon.tsx` — the SVG, matching the existing icon weight
  (`strokeWidth 1.8`, `h-4 w-4`).
- Rendered as a `<Link href="/settings">` styled like the Log out pill, in
  `app/(app)/layout.tsx`. If the public layout renders a signed-in header of its
  own, the gear goes in the same place there; the gear never shows to anonymous
  visitors.

## 2. Route

`app/(app)/settings/page.tsx` — a server component behind
`requireProfile("/settings")`. The layout's existing `BackButton` supplies
"← Back", so the page adds no navigation of its own.

The page loads, in one `Promise.all`: the auth user (for the current e-mail),
the owner's `profiles` row (notification flag), the owner's `profile_details`
row (privacy flags — read through the owner-only table, not through
`public_profile_details`), and the member's listing if any (for the pause
toggle).

Four cards, in this order: **Account**, **Privacy**, **Notifications**,
**Danger zone**.

## 3. Account

| Row | Control | Behaviour |
|---|---|---|
| Email address | current address + `Change` | Reveals an inline form. `changeEmailAction` calls `supabase.auth.updateUser({ email })`. Supabase mails a confirmation link to the new address; nothing changes until it is clicked. The card says so. |
| Password | `••••••••` + `Change` | Reveals current / new / confirm. `changePasswordAction` **re-authenticates first** with `signInWithPassword(currentEmail, current)`, then calls `updateUser({ password })`. |
| Sign out | button | The existing `signOutAction`. |

Supabase does not require the current password to set a new one when a session
exists. We require it anyway: this is the auth surface, and a borrowed unlocked
laptop should not be able to lock the owner out.

Validation reuses the rules already in `app/actions/auth.ts` — minimum 8
characters, the two new entries must match, and the `same_password` error code
maps to "Choose a password you haven't used before."

## 4. Privacy

Three toggles. The first two are enforced in the database, not merely hidden in
the UI.

- **Show my phone number to other members** — `profile_details.show_phone`,
  default `true` (preserves today's behaviour).
- **Show my e-mail address to other members** —
  `profile_details.show_contact_email`, default `true`.
- **Pause my listing** — mirrors `listings.is_active`; rendered only when the
  member has a listing. Identical in effect to the checkbox at the bottom of the
  listing form, surfaced where people go looking for it.

Enforcement: migration 0023 recreates `public.public_profile_details(uuid)`
(the `security definer` function from 0020) so it returns `null` for `phone`
when `show_phone` is false, and `null` for `contact_email` when
`show_contact_email` is false. That RPC is the **only** way another member's
details are read — `app/(app)/people/[id]/page.tsx` calls it and passes the
result to `ContactRow` and `profileGroups` — so a member querying Supabase
directly with their own session gets exactly what the UI gets. The owner's own
`/profile` and `/settings` still show the values, because those read the
owner-only `profile_details` row.

## 5. Notifications

One toggle: **Email me when a new room matches my preferences** —
`profiles.notify_new_matches`, default **`false`**. Opt-in, not opt-out.

### Sending

`lib/mail.ts` exports a single `sendMail({ to, subject, html })` built on
`nodemailer`, with the transport assembled from the `SMTP_*` environment
variables that already exist in `.env.local` and that
`scripts/auth-config.mjs` already hands to Supabase Auth:

```
SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=…  SMTP_PASS=…
SMTP_SENDER_EMAIL=…       SMTP_SENDER_NAME=NestUp
```

When any of them is unset, `sendMail` logs a warning and returns without
throwing, so local dev, CI and the test suite never attempt real delivery.

Known limits, accepted: Gmail allows roughly 500 messages a day, mail may land
in spam, and every message is from `lichtguy@gmail.com`. Adequate for a demo;
not something to fan out across all 92 seed accounts.

### Trigger

In `saveListingAction`, after a successful **insert** of an active listing
(never on an edit), the fan-out is handed to `after()` from `next/server` so it
runs once the response has been sent and publishing stays as fast as it is now.
A failure inside the fan-out is logged and swallowed — it must never turn a
successful publish into an error.

### Who receives it

`lib/notify.ts` selects recipients with the same logic the swipe deck uses, so
the e-mail never advertises a room the deck would have filtered out:

1. Every profile with `notify_new_matches = true`, excluding the listing owner.
2. `fitsHardFilters(seeker, listing)` — preferred cities and budget.
3. `sortKey(lifestyleScore(...), socialScore(...)) >= MIN_DECK_SCORE` (60).

Recipient address: `profile_details.contact_email` when set, otherwise the
member's auth e-mail.

This read crosses members, so it runs through a service-role client
(`lib/supabase/admin.ts`), server-only, used nowhere else. `SUPABASE_SERVICE_ROLE_KEY`
becomes a **sensitive Production environment variable on Vercel** — approved by
the user on 2026-08-27. It is still never passed as a build argument.

### The message

A small branded HTML template in `supabase/templates/new-match.html`, matching
the existing `recovery.html` / `confirmation.html`: room title, city, rent, one
photo, a button to `/browse/<id>`, and an unsubscribe line linking to
`/settings`. Subject: `A new room in <city> matches what you're looking for`.

## 6. Danger zone

A red-bordered card. `Delete my account` states plainly what is removed —
profile, listing, saved rooms, viewing history, conversations, messages — and is
irreversible. The button stays disabled until the member types their own e-mail
address into a confirmation field.

`deleteAccountAction` re-checks the typed address against the session user, calls
the new `public.delete_own_account()` function, signs out and redirects to `/`.

`delete_own_account()` is `security definer`, granted to `authenticated` only,
and does `delete from auth.users where id = auth.uid()`. Everything else
cascades: migration 0001 puts `on delete cascade` on `profiles.user_id →
auth.users(id)` and on every table that references `profiles.user_id` or
`listings.id`. No admin API key is needed for deletion.

## 7. Migration 0023

```sql
alter table public.profiles
  add column if not exists notify_new_matches boolean not null default false;

alter table public.profile_details
  add column if not exists show_phone boolean not null default true,
  add column if not exists show_contact_email boolean not null default true;

-- recreate public_profile_details(uuid) honouring the two flags
-- create public.delete_own_account()
```

All defaults are non-volatile, so the `ADD COLUMN`s rewrite nothing. Applied to
the live project (`eiykciushbnbwpxpvybi`) with the Supabase MCP, as 0021 and
0022 were.

## 8. Files

**New**
- `app/(app)/settings/page.tsx`
- `app/actions/settings.ts` — privacy toggles, notification toggle, pause listing, delete account
- `components/settings/AccountSection.tsx`
- `components/settings/PrivacySection.tsx`
- `components/settings/NotificationsSection.tsx`
- `components/settings/DangerZone.tsx`
- `components/settings/SettingToggle.tsx` — the shared switch row
- `components/ui/GearIcon.tsx`
- `lib/mail.ts`, `lib/notify.ts`, `lib/supabase/admin.ts`
- `supabase/migrations/0023_settings.sql`
- `supabase/templates/new-match.html`

**Changed**
- `app/(app)/layout.tsx` — the gear
- `app/actions/auth.ts` — `changeEmailAction`, `changePasswordAction`
- `app/actions/listing.ts` — the `after()` hand-off on insert
- `lib/types.ts` — `show_phone` / `show_contact_email` on `ProfileDetails` (the
  owner-only type). `PublicDetails` is unchanged: the flags never leave the
  database, because `public_profile_details()` has already nulled the hidden
  columns by the time `/people/[id]` sees them.
- `package.json` — `nodemailer` + `@types/nodemailer`

## 9. Behaviour and errors

Each card saves independently. Toggles save on change: optimistic flip, and on
failure they revert and show an inline error under the row. Forms (email,
password, delete) use `useActionState` like the rest of the app.

No "Saved." confirmation lines anywhere — consistent with the 2026-08-27 change
that removed them from the profile and listing forms. A toggle that has flipped
and stayed flipped is its own confirmation.

Mail failures are logged and swallowed; they never surface to the lister who
published, and never block a publish.

## 10. Testing

Unit (vitest, alongside the existing 240):
- recipient selection in `lib/notify.ts` — a seeker below 60 is skipped, one
  outside the budget is skipped, the owner never mails themselves, an opted-out
  member is skipped
- `lib/mail.ts` no-ops without SMTP vars and never throws
- the new-match template renders the room's title, city, rent and link
- change-password validation: mismatch, too short, wrong current password
- delete confirmation gate: the wrong e-mail does not delete
- `/people/[id]`: when the RPC returns a null `phone`, no phone entry is
  rendered in `ContactRow` (the flags themselves are never in the client's
  hands — this asserts the UI copes with the nulled column)

Live check on `nestup-kappa.vercel.app` with Playwright, per the project's
deploy-then-verify rule: the gear appears between the toggle and Log out,
toggles persist across a reload, a hidden phone number disappears from another
member's view of the profile, and publishing a matching room delivers one mail.

## 11. Build order

**Phase 1** — gear, route, Account, Privacy, Danger zone, migration 0023. No new
dependencies, no new secrets.

**Phase 2** — Notifications: `nodemailer`, `lib/mail.ts`, `lib/notify.ts`,
`lib/supabase/admin.ts`, the template, the `after()` hand-off, and
`SUPABASE_SERVICE_ROLE_KEY` added to Vercel.

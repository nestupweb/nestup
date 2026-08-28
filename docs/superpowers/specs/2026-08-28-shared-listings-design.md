# Shared / collaborative listings — design

**Date:** 2026-08-28
**Migration:** `supabase/migrations/0032_shared_listings.sql` (applied to the live project)

A listing used to have exactly one author. Real flats do not: several roommates
share the rent, and each of them wants the room they are advertising to appear
on their own profile. The creator now tags the roommates who already live
there, and every tagged member is asked before anything of theirs changes.

Three rules drive the whole design:

1. **The creator publishes immediately.** Tagging never delays or gates the
   listing going live.
2. **Nobody is added to anything without saying yes.** A tag is a question.
3. **`max_tagged = roommates_count - 1`.** `roommates_count` is the form's
   "Current roommates" — the people sharing the home *besides* the creator. One
   of those rooms is the one being advertised, so it stays untagged and open for
   the seeker who answers the ad.

---

## 1. Data model

### Why two tables

`listing_residents` (migration 0006) already existed and already meant
"confirmed member of this room's household". It is read in seven migrations
(0008 household chat, 0014/0015/0024 `my_conversations`, 0027
`linked_to_listing`, 0029 report subjects, 0031 blocks) and four TypeScript
files, and **every one of those readers grants household chat access**.

Putting a `status` column on that table would have forced all eleven readers to
learn to filter it, and the one that got missed would have handed an
unconfirmed person the household's private conversations with seekers. So the
*asking* and the *membership* are kept apart:

| Table | Means | Written by |
|---|---|---|
| `listing_invites` (new) | X was asked to co-post L, and answered Y | the two functions below, only |
| `listing_residents` (0006, unchanged) | X **is** a member of L's household | `respond_to_listing_invite`, on Yes |

Nothing writes `listing_residents` until someone presses Yes, so all eleven
existing readers stay correct without being touched.

### `listing_invites`

```sql
create type listing_invite_status as enum ('pending', 'accepted', 'declined');

create table public.listing_invites (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id)      on delete cascade,
  invitee_id    uuid not null references public.profiles(user_id) on delete cascade,
  inviter_id    uuid not null references public.profiles(user_id) on delete cascade,
  status        listing_invite_status not null default 'pending',
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  unique (listing_id, invitee_id),
  constraint invite_not_self check (invitee_id <> inviter_id)
);
```

Indexes: a partial index on `(invitee_id) where status = 'pending'` (the hot
read — every Profile page load) and one on `(listing_id)`.

### Row-level security

One `SELECT` policy: a row is visible to its invitee and to the listing's
owner. **No insert, update or delete policy exists at all** — the same shape
`matches` (0001) and `suspensions` (0029) use. A member cannot `PATCH` their own
invite to `accepted`, and cannot forge one naming somebody else.

### Functions

Both are `security definer`, `set search_path = ''`, and re-derive the caller
from `auth.uid()`.

**`invite_listing_roommates(p_listing uuid, p_invitees uuid[]) → integer`**

Called with the *whole* tag list on every save, and reconciles to it:

- ids that are new → a pending invite;
- ids that have gone → their invite **and** their `listing_residents` row are
  deleted (un-tagging a confirmed co-poster removes them);
- ids that already answered → left exactly as they are, so re-saving the form
  never re-asks anyone, and never re-asks someone who declined.

Refuses: a caller who isn't the owner; more than `roommates_count - 1` invitees;
an id with no profile; and any member blocked in either direction (`is_blocked`,
0029) — so a block can't be walked around by tagging someone into your
household. Returns the number of invitations still outstanding.

Un-tagging is scoped *through* `listing_invites`, so a resident who was never
invited through this path (the seed's households) is left alone.

**`respond_to_listing_invite(p_invite uuid, p_accept boolean) → uuid`**

Yes and No are one statement each. Yes sets `accepted` **and** inserts the
`listing_residents` row; No sets `declined` and writes no membership. The row is
locked `for update`, so two taps on Yes — or Yes in one tab and No in another —
cannot both get past the `pending` check. Refuses anyone who isn't the invitee,
and any invite that was already answered. Returns the listing id.

---

## 2. API

Every rule lives in the two database functions. Both the Server Actions and the
REST routes go through one shared module, `lib/invites.ts`, so there is a single
code path and no duplicated business logic.

```
app/api/**            REST routes ─┐
app/actions/co-posters.ts  Actions ─┴─→ lib/invites.ts ─→ SQL functions (0032)
```

`lib/invites.ts` is deliberately **not** a `"use server"` module: an exported
async function in one becomes a callable endpoint of its own.

### REST endpoints

| Method | Path | Body | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/invites` | — | `{ invites: [{ id, listing, inviter }] }` | The caller's own pending invitations. No id to pass or forge — RLS scopes it. |
| `PATCH` | `/api/invites/:id` | `{ "status": "accepted" \| "declined" }` | `{ id, status, listing_id }` | The Yes/No. |
| `GET` | `/api/listings/:id/invites` | — | `{ listing_id, invitees: [...] }` | Who is tagged and what they answered. RLS returns rows only to the owner and each invitee. |
| `POST` | `/api/listings/:id/invites` | `{ "invitees": [uuid, …] }` | `{ listing_id, pending, invitees }` | Sets the whole list (reconciles). |

Authentication is the ordinary session cookie, via `getAuthContext()` rather
than `requireUser()` — an API route must answer `401`, not redirect to sign-in.

Status codes are derived once, in `lib/co-posters.ts`, from the database's own
refusal, so the routes stay wrappers and the two readings of a refusal cannot
drift apart:

| Situation | Status |
|---|---|
| not signed in | 401 |
| malformed body / id | 400 |
| not the owner; tagging a blocked member; not your invitation | 403 |
| listing or invite not found; tagged member gone | 404 |
| already answered | 409 |
| over the cap | 422 |

### Server Actions (`app/actions/co-posters.ts`)

- `searchMembersAction(q)` — ≤8 profiles matching a name, excluding self and
  everyone blocked in either direction. Escapes ILIKE's `%`/`_` so a member
  searching for `a_b` means it literally.
- `respondToInviteAction(prev, formData)` — the card's Yes/No.

Tagging has no action of its own: it happens inside `saveListingAction`, which
calls `inviteRoommates` after the listing row is written.

---

## 3. Frontend

**Creation** — `components/listings/RoommateTagPicker.tsx`, in a new "Who else
lives here" section of the listing form. Debounced search with a keyboard-
navigable listbox; picked people become removable rows backed by hidden
`tagged_roommates` inputs, each showing where their invitation stands. The
"Current roommates" input became controlled so the cap recomputes live as it
changes; lowering it below the number already tagged raises the error rather
than silently dropping people. At the cap the search input disables itself.

**Publishing** — `saveListingAction` checks the cap before writing, saves the
listing, then reconciles the tags. The listing is live for its creator either
way; if the invitations fail, the error says so explicitly ("Your listing is
saved, but your roommates weren't added — …") rather than implying the publish
failed.

**Confirmation** — `components/profile/CoPosterInvites.tsx` renders the pending
cards at the top of the **My Listings** tab (renamed from "My listing"), each
asking *"[Author Name] added you to a shared listing. Confirm to join as a
co-poster?"* with Yes / No. Each card is its own form with its own action
state, so a failure on one never marks the others. The tab carries a count
badge while anything is pending.

**After Yes** — the room appears under "Shared with you" in My Listings with a
"Co-poster" badge and **no** Edit / Delete / Mark-taken: managing the room stays
with its creator, which is also all the database permits. Because the Yes wrote
a `listing_residents` row, the co-poster automatically gains everything that
already existed for residents — household chat access (0008), a place under
"Who lives here" on the listing page, and the room on their `/people/[id]`
page. The listing detail page, Swipe and `/people/[id]` needed no changes.

**After No** — the association is removed; the row remembers only that they were
asked and declined, which is what stops the creator's next save from asking
again. The listing stays active for the creator and any other confirmed
roommates.

---

## 4. Decisions taken

- **A co-poster may still host their own room.** The `one_active_listing_per_owner`
  index keys on `owner_id`, and a co-poster is not an owner, so nothing extra was
  needed.
- **Co-posters cannot edit the listing.** Loosening the owner-only update policy
  would have meant reworking mark-taken and delete ownership too; display plus
  household access covers what "co-poster" is for here.
- **"Shared with you" is keyed on membership, not on an accepted invite** (decided
  2026-08-28 after seeing it live). `getCoPostedListings` reads `listing_residents`,
  so the 1,289 seed residency rows put ~2.17 rooms into the average seed account's
  My Listings even though `listing_invites` is empty. That is deliberate: the same
  relation already lists those members under "Who lives here" and shows the room on
  their `/people/[id]` page, so gating this one view on an invite would have a
  member appear in a household on the listing page while that room was missing from
  their own profile. The alternative — joining through `listing_invites` — is a
  one-line change in `lib/invites.ts` if that trade is ever revisited.
- **The cap counts invitations, not residents.** A household seeded with
  residents who were never invited through this path could exceed
  `roommates_count - 1` in total. Accepted: seed data is synthetic, and the rule
  as specified is about tagged users.

## 6. Co-ownership (migration 0033)

A later change made confirmed roommates **co-owners**, not guests. Three parts:

### One person, one home

A member cannot be invited to a second home: not if they own a live listing,
and not if they have already confirmed one as a roommate. Enforced in
`invite_listing_roommates` (which names the person in the error) and again in
`respond_to_listing_invite`, because an invitation raised before the invitee
took a room of their own must not become a second home when they finally answer
it. Declining is always allowed. Only *live* rooms disqualify — a paused, taken
or deleted listing frees a member to be tagged again. `getBusyMemberIds` filters
the same people out of the picker so nobody is offered and then refused.

### Equal permissions

`can_manage_listing(listing)` — creator **or** confirmed resident — replaces
`owner_id = auth.uid()` in the UPDATE and DELETE policies on `listings` and in
`mark_listing_taken` / `remove_listing`. It is SECURITY DEFINER on purpose:
`is_household_member` (0008) reads `listings` through RLS and so answers "no"
for a row the caller cannot already SELECT, which would have left a co-owner
unable to re-open the very room they had just closed.

Two guards make this safe:

- **`listings_owner_is_permanent`** — a BEFORE UPDATE trigger refusing any
  change to `owner_id`. Without it a co-owner could set `owner_id` to
  themselves and RLS would allow it, since they are a household member both
  before and after; `with check` cannot see the old row, so the rule must be a
  trigger. `saveListingAction` correspondingly stopped writing `owner_id` on
  update — it is set once, on insert.
- **a household SELECT policy** — a co-owner could not otherwise read the room
  once it was paused or taken, which would hide it from My Listings and make
  `remove_listing`'s own SELECT come up empty and report "already gone".

Because RLS now decides rather than an `owner_id` filter, the writes ask which
rows actually came back (`.select("id")`): a row RLS refuses returns zero rows
and **no error**, which would otherwise read as a silent success.

Tagging stays the creator's alone, so a co-owner's save skips
`inviteRoommates` and their form hides the picker.

**This makes delete a one-way door for the whole household**: any co-owner can
take the room down for all of them, and `remove_listing` is irreversible.

### Seed consequence: seekers

Enforcing "one person, one home" against the existing demo data left **2 of 817
members taggable** — every one of the 813 seed owners has an active listing, so
the picker came back empty for every search. The rule is right for real users;
the seed data simply had no seekers in it, only owners.

Fixed with data rather than by softening the rule: a wave of 25 members with a
profile and **no listing** (`SEEKERS` in `scripts/seed-data.ts`), spread across
the launch cities. Appended as a new wave in keeping with the add-only seed rule
— nothing above it changes, the wave-1 sha256 fingerprint still holds, and the
portraits come from the same eye-checked pool waves 2–5 use. They are
deliberately excluded from the seeder's roommate pass: giving a seeker a
`listing_residents` row would house them and take them straight back out of the
picker, which is the one thing they exist to be in.

### Shared state

There is only ever one `listings` row, so there is no copy to reconcile — every
co-owner reads and writes the same record, and `revalidatePath` refreshes it
everywhere. `SharedListingSync` makes it *immediate*: `listings` joins the
realtime publication and each co-owner's My Listings subscribes to the rooms
they manage (one binding per room, not a blanket subscription), refreshing on
any change. The token must reach the socket before the channel joins, exactly as
`ChatRealtime` documents.

## 5. Tests

- `tests/unit/co-posters.test.ts` — the cap at every boundary, the invitation
  sentence, id cleaning, and every database refusal → sentence + status code.
- `tests/unit/roommate-tag-picker.test.tsx` — cap enforcement, disabling at the
  cap, lowering the count past the tags, removal, no re-offering someone already
  tagged, and no round-trip for a one-letter query.
- `tests/unit/co-poster-invites.test.tsx` — the exact sentence, both buttons, and
  that each card carries its own invite id.
- `tests/unit/co-posters-action.test.ts` — both answers, junk refused before the
  database, and each refusal surfaced correctly.
- `tests/unit/my-listing.test.tsx` — invitations above the member's own room,
  "Shared with you" badging, and no owner's buttons on a co-posted room.
- The SQL itself was exercised against the live project with impersonated
  sessions: over-cap refused, non-owner refused, stranger's answer refused,
  accept writes membership, double answer refused, decline writes none, re-save
  preserves answers, un-tagging removes membership.

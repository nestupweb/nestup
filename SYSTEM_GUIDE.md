# NestUp — System Guide

The internal guide to what NestUp is, how it is built, and why each part is built that way. Every claim here points at the file that implements it.

- **Live:** https://nestup-kappa.vercel.app
- **Repository:** https://github.com/nestupweb/nestup
- **Companions:** [Local Setup](LOCAL_SETUP.md) · [Test Plan](TEST_PLAN.md) · [Product Spec](docs/submission/01-product-spec.md) · [Technical Design](docs/submission/02-technical-design.md) · [Scale](docs/submission/04-scale.md) · [Security](docs/submission/05-security.md)

---

## Contents

1. [What NestUp does](#1-what-nestup-does)
2. [Business value](#2-business-value)
3. [Architecture](#3-architecture)
4. [Folder structure](#4-folder-structure)
5. [The database](#5-the-database)
6. [Main flows](#6-main-flows)
7. [Authentication](#7-authentication)
8. [Permissions and authorisation](#8-permissions-and-authorisation)
9. [The matching algorithm](#9-the-matching-algorithm)
10. [Personalisation](#10-personalisation)
11. [AI photo verification](#11-ai-photo-verification)
12. [Security](#12-security)
13. [Scalability](#13-scalability)
14. [Tests](#14-tests)
15. [Known limitations](#15-known-limitations)

---

## 1. What NestUp does

**Find a room in a shared apartment — and the roommates you will actually get along with.**

Every room-finding tool indexes apartments: rent, size, neighbourhood. But when you move into a shared flat, the apartment is not what you are choosing — **the people are**. Everything that decides whether it works (sleep schedules, guests, cleanliness, smoking, diet, Shabbat) is either missing from those listings or buried in free text nobody can filter on.

NestUp matches on both. Every room carries two scores against your profile:

- a **Lifestyle** score (0–100) from rent, city, move-in date and eleven habit/preference rows;
- a **Social** score (0–100) from shared interests.

The swipe deck admits only rooms whose combined score reaches 60, so a seeker visits three apartments instead of ten.

It is also built around the **household**, not the poster. A chat thread contains every roommate in the flat, a listing can be co-owned by the people living in it, and a shared listing survives the account that created it.

### Who uses it

| Role | What they do |
|---|---|
| **Seeker** | Creates a profile, answers the Daily-life questionnaire, browses Listings publicly or swipes a ranked deck, likes rooms, messages households, schedules viewings. |
| **Lister / household** | Publishes one room with photos, address, house rules and weekly viewing hours; tags roommates as co-posters; answers seekers; marks the room taken. |
| **Co-poster** | A roommate invited onto someone else's listing. Gets the owner's buttons on it, and can inherit it if the creator deletes their account. |
| **Visitor** | No account. Can read `/` and `/browse` including room pages and the map. No scores, no hearts, no chat. |

Every member can be both a seeker and a lister; there is one account type and no admin UI.

---

## 2. Business value

The problem is a **real cost paid in time**. Finding a flatshare today means reading dozens of near-identical adverts, messaging strangers, and travelling across a city to discover in the first ninety seconds that the household goes to bed at 23:00 and you do not.

NestUp attacks that in three ways:

1. **It filters on what actually decides the outcome.** The eleven scored rows are exactly the things that make a flatshare fail. They are asked once, on the profile, and applied to every room automatically — `lib/compatibility.ts`.
2. **It refuses to show weak matches in the deck.** `MIN_DECK_SCORE = 60` in `lib/swipe.ts`. Fewer, better rooms is the product. Weak matches are still reachable through Listings, so nothing is hidden outright.
3. **It talks to the household, not the advertiser.** `findOrCreateConversation` opens one thread per (room, seeker) that every roommate is in — `lib/chat.ts`, migration `0008_household_chat.sql`.

Measurable goals, in the order they matter: **viewings booked per seeker**, **time from sign-up to first message**, **share of decks that are non-empty**, and **rooms marked taken**.

---

## 3. Architecture

```
                    Browser (React 19)
   client components: swipe deck, chat composer, maps, pickers
                            │
             Server Components · Server Actions · Route Handlers
                            │
  ┌─────────────────────────┼──────────────────────────┐
  │                         │                          │
  │  Next.js 16.3 App Router (Vercel, Node runtime)    │
  │   · proxy.ts          — session refresh + gate     │
  │   · use cache / private — per-member caches        │
  │   · cacheTag / updateTag — targeted invalidation   │
  └─────────────────────────┬──────────────────────────┘
                            │  @supabase/ssr (cookie-bearing)
                            │  createPublicClient (cookie-free, shared cache)
                            ▼
        Supabase — Postgres 17 · Auth · Realtime · Storage
          RLS on all 21 tables — authorisation lives here
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
      Gemini (photo check)      Nominatim / Overpass / CARTO
      Google Calendar (opt-in)  Nodemailer SMTP (auth mail)
```

### Layer by layer

| Layer | Choice | Where |
|---|---|---|
| Framework | Next.js 16.3, App Router, React Server Components | `app/` |
| Language | TypeScript, `strict` | `tsconfig.json` |
| Data access | Supabase JS + `@supabase/ssr` | `lib/supabase/{server,client,public,admin,middleware}.ts` |
| Mutations | **Server Actions** — 14 modules, all `"use server"` | `app/actions/` |
| Public reads | **Route Handlers** — 10, JSON | `app/api/`, `app/auth/` |
| Validation | Zod 4 schemas, one per surface | `lib/validation/` |
| Styling | Tailwind CSS v4, semantic tokens, light + dark | `app/globals.css` |
| Maps | MapLibre GL + CARTO basemaps, keyless, self-hosted worker | `components/map/`, `public/maplibre/` |
| Realtime | Supabase Realtime channels | `components/chat/ChatRealtime.tsx` |
| Tests | Vitest 4, React Testing Library, Playwright | `tests/`, `scripts/check-*.mjs` |
| Hosting | Vercel + Supabase | — |

### Three Supabase clients, on purpose

`lib/supabase/` has four factories, and picking the wrong one is the single easiest way to create a cross-user leak:

| Factory | Carries cookies? | Used for |
|---|---|---|
| `server.ts` → `createClient()` | **Yes** | Everything member-specific. RLS sees the caller. |
| `public.ts` → `createPublicClient()` | **No** | `queryListings` only — the one **shared** cache. Its output must not depend on who asks. |
| `client.ts` → `createBrowserClient()` | Yes | Browser-side realtime and storage uploads. |
| `admin.ts` | Service role | `scripts/seed.ts` and the cross-member read behind new-match emails. Never on a request path a member controls. |

`lib/listings.ts` explains the rule in place: `queryListings` is cached in the shared store *because* it goes through the cookie-free client; the per-member score is fetched separately by `getListingScoreContext`, which is `use cache: private`.

### Caching, and why it is a correctness concern

Next 16's Cache Components are switched on (`next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`). Two kinds of cache are used:

- **`"use cache"`** — shared across everyone. Exactly one reader uses it: `queryListings`.
- **`"use cache: private"`** — held in the requesting browser only, keyed by member. The deck (`lib/swipe-deck.ts`), the inbox (`lib/chat.ts`), the session and own profile (`lib/auth.ts`), saved-room ids and score context (`lib/listings.ts`).

Every cached read carries a tag from `lib/cache-tags.ts` (`deck:<id>`, `chat:<id>`, `saved:<id>`, `profile:<id>`, `listing:<id>`, `listings`, `session`), and every mutation calls `updateTag` on exactly what it changed. This replaced a design where each write fired a fistful of `revalidatePath` calls — so editing a room also discarded that member's chats. `tests/unit/cache-invalidation.test.ts` fails if that regresses.

The visible payoff: returning to Swipe, Listings, Chat or Profile makes **zero server requests** and shows no loading skeleton.

---

## 4. Folder structure

```
app/
  (public)/            Anonymous-readable routes
    page.tsx           Landing
    browse/            "Listings" — index, room page, per-room chat entry
  (auth)/              login · signup · verify · forgot-password · reset-password
  (app)/               Signed-in: swipe · chat · chat/[id] · listing
                       profile · profile/edit · people/[id] · settings
  actions/             14 Server Action modules (see below)
  api/                 Route Handlers: listings, listings/pins, places,
                       invites, invites/[id], listings/[id]/invites, google/*
  auth/                confirm (emailed links) · signout (303)
  layout.tsx           Root layout, theme bootstrap
  manifest.ts          PWA manifest

components/            97 components, grouped by feature
  auth/ chat/ listings/ map/ profile/ settings/ swipe/ ui/

lib/                   66 domain modules — no React, mostly pure
  compatibility.ts     Lifestyle + social scoring
  swipe.ts             Hard filters, deck build, gender rules
  swipe-deck.ts        The cached, server-only deck read
  affinity.ts          Attention-based personalisation (pure)
  listings.ts          Browse query, filters → SQL, map pins
  chat.ts              Inbox, thread creation, read/delete
  auth.ts              Session gates, cached and uncached
  moderation.ts        Blocking + suspension reads
  photo-check.ts       Signed verdicts + publish audit (server-only)
  photo-vision.ts      The Gemini call itself
  notify.ts            Who gets a new-listing email
  cache-tags.ts        Every cache tag, in one place
  validation/          Zod schemas: profile, listing, filters, message, report, about
  supabase/            The four clients

supabase/
  migrations/          48 SQL files, 0001 → 0044
  templates/           Auth email HTML

tests/
  unit/                107 test files
  helpers/, stubs/     Shared mocks

scripts/               seed, geocoding, real-browser checks, docs → PDF
docs/submission/       Product spec · technical design · test spec · scale · security
```

### The 14 Server Action modules

| File | What it owns |
|---|---|
| `auth.ts` | Sign up, sign in, verify, resend, password reset, change email, change password |
| `profile.ts` | The profile upsert, and routing to the "no city" prompt |
| `about.ts` | The About-me detail fields (`profile_details`) |
| `listing.ts` | Publish/edit a room, address preview + geocoding, delete |
| `listing-status.ts` | Pause, resume, mark taken, reopen |
| `swipe.ts` | Record a swipe, send the intro hello, save the hello template |
| `saved.ts` | The heart toggle |
| `dwell.ts` | Attention readings for personalisation |
| `chat.ts` | Send message, mark read, delete chat, realtime sync |
| `viewing.ts` | Propose/respond to a viewing, Google Calendar sync |
| `co-posters.ts` | Member search, answer an invitation |
| `moderation.ts` | Report, block, unblock |
| `settings.ts` | Privacy, notifications, listing active, delete account |
| `photo-check.ts` | Check-then-upload a listing photo |

---

## 5. The database

**Postgres 17 on Supabase.** 21 tables — **RLS enabled on every one** — carrying 50 live policies, plus 7 more on `storage.objects`. Also 36 functions, 9 triggers, 20 indexes and 3 storage buckets. Defined by 48 migrations in `supabase/migrations/`, applied in filename order.

### Tables

| Group | Table | Notes |
|---|---|---|
| **People** | `profiles` | One row per member. Identity, the Daily-life answers ("how I live" + "what I want in roommates"), interests, chores, budget, preferred cities, move-in date. `0035` made every Daily-life column nullable — `null` means *not answered*, which scores differently from a "no". |
| | `profile_details` | The private/contact half: about text, languages, phone, socials, intro template. Split from `profiles` so the public read is a different table, not a column allow-list. |
| **Rooms** | `listings` | The room. Address + `lat`/`lng`/`coords_source`, rent, rooms, amenities, house rules, `wanted_gender`, photos and their labels, weekly `viewing_slots`, `is_active`, `taken_at`, `removed_at`. |
| | `listing_residents` | Who lives there. Drives household chat membership and co-ownership. |
| | `listing_invites` | Co-poster invitations, `pending` / `accepted` / `declined`. |
| | `saved_listings` | Hearts. Unique on `(user_id, listing_id)`. |
| **Matching** | `swipes` | One row per (seeker, room) with `like`/`skip`. Unique on `(seeker_id, listing_id)` — that key is what stops a decided room returning. |
| | `matches` | Mutual interest. No write policy — written by a function only. |
| | `listing_dwell` | Attention readings: `dwell_ms`, `photos_seen`, `pages_seen`, with CHECK ceilings (`0035`). |
| | `listing_views` | Per-member view history — one row per (member, room), behind the History tab. Read and inserted by its owner only. |
| **Chat** | `conversations` | One per (listing, seeker). Unique constraint; `findOrCreateConversation` survives losing the race to it. |
| | `messages` | With `client_id` for idempotent retries (`0015`). |
| | `conversation_reads` / `conversation_deletes` | Per-member read cursor and per-member delete cutoff — "delete chat" hides a thread for one side only, and a new message revives it (`0024`). |
| | `viewings` | Proposed/confirmed/declined viewings. `viewings_one_open` trigger enforces one open viewing per chat (`0016`). |
| **Safety** | `reports` | Unique on (reporter, subject) so a second report cannot inflate a count. |
| | `blocks` | Mutual in effect: `blocked_user_ids()` returns both directions. |
| | `suspensions` | **Read policy only, no write policy at all.** |
| | `app_config` | The suspension threshold, tunable. **RLS on, zero policies.** |
| **Plumbing** | `auth_mail_throttle` | Hashed addresses + timestamps. **RLS on, zero policies.** |
| | `google_tokens` | OAuth tokens for calendar sync, owner-scoped. |

### Denormalised columns maintained by triggers

Two facts are computed when the household changes rather than joined on every read:

- **`listings.household_size`** (`0042`) — the number the cards actually show. Filtering "max 2 roommates" on the typed `roommates_count` returned cards reading "3 roommates"; filtering on the derived column does not.
- **`listings.household_gender`** (`0037`) — set only when **every** member states the same gender, otherwise `null`. This turns the "all roommates the same gender" filter into one indexed equality instead of a subquery per row.

Both are kept current by `tg_listing_household_*` / `tg_resident_household_*` / `tg_profile_household_gender`.

### Functions doing work the app must not do

`SECURITY DEFINER` functions are used where a rule spans rows a member is not allowed to read, or must be atomic:

| Function | Why it exists |
|---|---|
| `delete_own_account(p_heir)` | Deletes the account **and hands a shared listing to a roommate in the same transaction** (`0040`). It refuses if there are several eligible heirs and none was chosen. |
| `respond_to_listing_invite` | Checks the caller is the invitee, writes the answer and the `listing_residents` row atomically; raises a 409 on a second answer (`0032`). |
| `invite_listing_roommates` | Enforces the tagging cap and the block rule server-side (`0033`). |
| `blocked_user_ids()` | Both directions of blocking — a member may not read rows where they are the blocked party. |
| `apply_report_suspension` | Trigger: suspends at the threshold in `app_config`, or immediately for `inappropriate_images` (`0029`). |
| `clear_conversation`, `mark_conversation_read` | The database picks the timestamp, so a message inserted in the same instant still counts correctly. |
| `mark_listing_taken`, `remove_listing` | Close a room and message every open thread about it, reporting how many were told. |
| `search_available_members` | Applies all three tag-picker rules *before* the limit (`0034`, `0036`). |
| `my_conversations`, `my_unread_count` | The inbox and the badge, RLS-scoped inside SQL. |

### Indexes

Twenty, each supporting a query that actually runs. The ones worth knowing:

| Index | Serves |
|---|---|
| `listings_browse_idx (city, rent, available_from) where is_active` | The Listings query — the app's most frequent read, and the reason the filters are pushed into SQL |
| `listings_household_gender_idx`, `listings_wanted_gender_idx`, `listings_household_size_idx` — each `where removed_at is null` | The three derived-column filters, so "all roommates female" and "max 2 roommates" are indexed equalities |
| `swipes_by_seeker_idx (seeker_id)` | "What has this member already decided on" — read on every deck build |
| `swipes_likes_by_listing_idx (listing_id) where direction = 'like'` | Partial: interest in one room, without scanning skips |
| `messages_conversation_idx (conversation_id, created_at)` | A thread, in order |
| `listing_dwell_by_user_idx (user_id, updated_at desc)` | The 200 most recent attention readings behind personalisation |
| `listing_invites_pending_idx (invitee_id) where status = 'pending'` | Partial: the invitation cards, without scanning answered rows |
| `profiles_full_name_trgm_idx` — GIN, `gin_trgm_ops` | Fuzzy name search in the co-poster picker |

Plus `matches`, `blocks`, `reports`, `viewings`, `saved_listings`, `listing_views` and `auth_mail_throttle` covering their own lookup columns.

**There is deliberately no `lat`/`lng` index.** The map queries are bounded by `limit` (2 000 for the whole country, 300 for the nearby box) over a table in the hundreds of rows, so the planner's sequential scan is cheaper than maintaining a spatial index. That is a decision that expires — see §13.

---

## 6. Main flows

### 6.1 Register → confirm → onboard

`components/auth/AuthForm.tsx` → `signUpAction` (`app/actions/auth.ts`) → `sendConfirmationMail` (`lib/auth-mail.ts`) → email → `app/auth/confirm/route.ts` → `/profile?onboarding=1`

Registration **does not return a session**. `sendConfirmationMail` creates the account and mints a code, then sends the mail itself through Nodemailer — Supabase's own mailer is not asked to send, because it produces HTML-only mail that measurably landed in spam. A per-address throttle (`auth_mail_throttle`, `0036`) replaces GoTrue's rate limit and stores addresses hashed.

### 6.2 Build a profile

`components/profile/ProfileForm.tsx` → `upsertProfileAction` → `profiles` + `profile_details`, then `updateTag(profileTag)` and `updateTag(deckTag)`.

Four fields block a save: name, age, gender, occupation (`lib/validation/profile.ts`). Everything else may be left blank — a blank Daily-life row is `null`, "not answered", and is scored as neutral rather than as a mismatch. Saving without a preferred city succeeds but routes to `/swipe?needs=cities`, where `NoCityPrompt` explains that matches need one (`lib/apartment-prefs.ts`).

### 6.3 Publish a room

`components/listings/ListingForm.tsx` → per-photo `checkAndUploadPhotoAction` → `saveListingAction`

The form validates against `listingSchema`, checks the co-poster tag cap, parses the weekly viewing slots, audits the photo verdicts (§11), geocodes the address (`lib/geocode.ts` → Nominatim, refusing a hit in the wrong city), writes the listing, sends the roommate invitations, and emails matching seekers who opted in (`lib/notify.ts`). A room whose address cannot be placed is left off the map entirely rather than pinned at the city centre.

### 6.4 Browse (public)

`app/(public)/browse/page.tsx` → `listingFiltersSchema` → `queryListings` (shared cache) + `getListingScoreContext` (private cache) + `getSavedListingIds`

Anonymous-readable. Every filter field carries `.catch()`, so a hand-edited URL degrades to a default instead of erroring — `applyListingFilters` in `lib/listings.ts` translates the parsed filters into PostgREST calls with `range()` pagination. The same query is exposed as JSON at `GET /api/listings`.

### 6.5 Swipe

`app/(app)/swipe/page.tsx` → `getCachedDeck` → `getPersonalisedDeck` → `getSwipeDeck` + `rankByAffinity`

Nine round-trips in three dependent waves, cached per member behind `deck:<id>`. Described in full in §9 and §10.

### 6.6 Like → hello → chat → viewing

`recordSwipeAction` → `IntroSheet` → `sendIntroAction` → `findOrCreateConversation` → `messages` → `ChatRealtime` → `proposeViewingAction`

A like writes to `swipes` **and** mirrors into `saved_listings`, so the deck heart and the Listings heart are the same thing. The hello opens (or reuses) one thread with the whole household and marks the sender's own copy read.

Realtime is the one place a cache must be invalidated by *someone else's* write: an incoming message calls `syncChatAction`, which drops `chat:<me>` in the receiving browser. `ChatRealtime.tsx` sets the auth token on the socket *before* the channel joins, and coalesces a burst into one invalidation.

Viewings are proposed inside the thread, constrained to the listing's weekly hours in the listing's own timezone (`lib/availability.ts`), and limited to one open viewing per chat by a trigger. An approved viewing offers a Google Calendar link, or a real calendar insert if the member connected Google (`app/api/google/*`).

### 6.7 Close a room, or leave

`markListingTakenAction` closes the room and messages every open thread with a sentence the owner can edit, reporting how many people were told. `deleteAccountAction` calls `delete_own_account`, which hands a shared listing to a roommate inside the same transaction — deleting an account must not delete a home out from under the people living in it.

---

## 7. Authentication

**Supabase Auth, email + password, confirmation mandatory.** `lib/supabase/server.ts` + `@supabase/ssr` keep the session in cookies; `proxy.ts` refreshes it on every matched request.

### The three gates

| Gate | Where | What it does |
|---|---|---|
| **Edge/proxy** | `proxy.ts` → `lib/supabase/middleware.ts` | Calls `auth.getUser()` **uncached on every request**. `/swipe`, `/listing`, `/profile`, `/chat` and `/browse/:id/chat` redirect to `/login?next=…` without a session (the prefix list also still carries `/matches`, which no longer has a page). Page routes only — an API caller must get a JSON 401 from its own handler, not an HTML redirect. |
| **Render-time** | `requireCachedSession` / `requireCachedProfile` in `lib/auth.ts` | The cached identity used to *render* signed-in pages. |
| **Write-time** | `requireUser()` in `lib/auth.ts` | Uncached. **Every Server Action goes through this.** |

The distinction between the last two is deliberate and is enforced by a test. Caching `auth.getUser()` removed a ~300 ms skeleton from three tabs, at the cost of a suspension taking effect within the cache window rather than on the very next page. What it does **not** cost: the proxy still checks uncached on every request, and **no Server Action may authorise itself with the cached session** — `tests/unit/cached-session-boundary.test.ts` scans the action files and fails if one does.

### Sign-in specifics — `signInAction`

- Address and password are checked before Supabase is asked anything.
- A wrong password and an unknown address return the **same** sentence. Only `email_not_confirmed` gets its own, because sending someone to reset a password that was never the problem is worse than the small disclosure.
- A suspended account is signed straight back out. Checked *after* sign-in, because `suspensions` is readable only by its owner — which is also what stops this being a way to ask whether someone is suspended.
- `?next=` goes through `sanitizeNextPath` (`lib/redirect.ts`), which rejects absolute URLs, protocol-relative `//`, backslash escapes, and tabs/newlines that browsers strip before resolving.
- On success, `updateTag(SESSION_TAG)` drops the cached "nobody" before the soft redirect.

### Signing out is a Route Handler, not an action

`app/auth/signout/route.ts` answers **303**. A Server Action's `redirect()` is a soft navigation, so the member's cached deck, inbox and profile — and the router's rendered copies of those pages — would survive it in the tab. Only a full document load empties them. There is deliberately **no GET handler**, so a logout cannot be triggered by an `<img>` on another site.

---

## 8. Permissions and authorisation

**Authorisation lives in Postgres, not in the app.** Every query runs on a cookie-bearing client, so Postgres decides what comes back regardless of what the TypeScript says. The app layer is convenience; RLS is the rule.

| Actor | Can read | Can write |
|---|---|---|
| **Anonymous** | Active, non-removed `listings`; nothing else | Nothing |
| **Authenticated** | Own rows everywhere; other members' `profiles`; the public half of `profile_details`; listings they are linked to even when closed | Own profile, own listing (+ co-posted), own swipes/hearts/dwell, messages in their own conversations, reports and blocks |
| **Suspended** | Bounced from every signed-in page by `requireUser`; RLS refuses their writes (`0029`) | Nothing |
| **Blocked pair** | Hidden from each other's decks, search and room lists, in both directions (`0030`, `0031`) | Cannot message each other |
| **Service role** | Everything | Seeding and the new-match email read only — never on a member-controlled path |

### Patterns worth knowing

- **Three tables have no write policy at all.** `matches` is written only by a function; `app_config` and `auth_mail_throttle` have RLS on and **zero** policies, so nothing but a `SECURITY DEFINER` function can touch them. That is stronger than a policy attempting to enumerate every legitimate write.
- **A block beats the "linked to this room" exception.** `0027` let a member linked to a room keep reading it after it closed; `0031` makes sure that cannot be used to see past a block.
- **The deck filters blocked *roommates* in TypeScript.** `0030` already hides a room whose owner is blocked. A room where the blocked person is only a resident still comes back, so `getSwipeDeck` drops it — "must not appear in each other's Swipe" is about the person, not about who signed the lease.
- **Cache tags are part of authorisation.** Every private tag carries the acting member's id. A tag missing that id would be one shared cache key for the whole application, which is the shape a cross-user leak takes. Asserted in `cache-invalidation.test.ts`.

---

## 9. The matching algorithm

Implemented in `lib/compatibility.ts` (scoring) and `lib/swipe.ts` (filtering, gating, ordering). Both are pure functions with no I/O, which is what makes them exhaustively testable.

### Step 1 — hard filters, before anything is scored

`fitsHardFilters(seeker, listing)`:

| Filter | Rule |
|---|---|
| City | The room must be in one of the seeker's preferred cities. No cities set → no filter. |
| Budget | `budget_min ≤ rent ≤ budget_max`. `0` means "no limit" on either side — **no 10 % grace here**, unlike the scoring. |
| `wanted_gender` | A room asking for one gender reaches nobody else, **including a seeker who has not stated one** — "only" has to mean only. |
| `pref_same_gender` | Ticked, the seeker sees only rooms where `household_gender` equals their own. Ticked without stating a gender is unanswerable, so it is skipped rather than emptying the deck. |

These run **in the SQL query as well as in `buildDeck`**. They used to run only in TypeScript over the newest 300 rooms, which was fine at 155 listings and became a bug at 490: the newest 300 were all small-town rooms, so a Tel Aviv seeker's own city fell out of the window and the deck came up empty.

### Step 2 — the Lifestyle score, 0–100

Eleven weighted components summing to exactly 100. Each is judged **from the viewer's side**: the looker's "what I want in roommates" against the other person's "how I live". The same function serves a seeker looking at a room and a lister looking at a seeker — pass the `perspective`.

| Component | Weight | Rule |
|---|---|---|
| Budget | 20 | Inside budget → full. Up to 10 % over → half. Beyond → 0. |
| City | 18 | In a preferred city → full, else 0. |
| Move-in | 10 | Within 14 days → full; within 45 → half; else 0. |
| Smoking | 10 | A smoker into a no-smoking room → 0. A smoking roommate for someone who said no → 0. |
| Cleanliness | 10 | 6 points for living alike (−1.5 per level of difference) + 4 for meeting the tidiness asked for (−2 per level short). |
| Pets | 8 | Symmetrical to smoking. |
| Sleep | 6 | An explicit preference is checked exactly; "flexible" earns two-thirds. With no preference, alike is full and flexible is two-thirds. |
| Guests | 6 | Over the stated tolerance → 0; otherwise by distance on the rare/sometimes/often scale. |
| Noise | 4 | Same shape, quiet/moderate/lively. |
| Diet | 4 | "Kosher" needs kosher; "vegetarian" accepts vegan; "vegan" needs vegan. |
| Shabbat | 4 | Checked against how the other keeps it. **"Prefer not to say" is neutral, never a mismatch.** |

**The neutral convention.** When a seeker has not set a preference, the component awards ~60 % of its weight (`neutral()`), not 0. Absence of a preference is not a mismatch, and a half-finished profile should still get a usable deck. `0035` made the columns nullable; `withDailyLifeDefaults` normalises `null` to the value the column used to default to, so nobody's score moved when that happened.

### Step 3 — the Social score, 0–100

`socialScore(a, b)` = `100 × |A ∩ B| / min(|A|, |B|)`. **Null**, never 0, when either side has no interests — a member who has not picked any has not scored badly, and the UI shows an em dash rather than a zero.

### Step 4 — the combined key and the gate

`sortKey(lifestyle, social)` averages the two, or falls back to lifestyle alone when social is null. `buildDeck` drops everything below `MIN_DECK_SCORE = 60` and sorts best first. Sixty is exactly where `scoreLabel` says "Good", and `tests/unit/compatibility-invariants.test.ts` asserts the two stay in step.

The same three rules decide who gets a new-listing email (`lib/notify.ts`), so an email can never advertise a room the app itself would have filtered out.

---

## 10. Personalisation

`lib/affinity.ts` — attention-based re-ranking. Everything in the file is pure: given the rooms a seeker lingered on, produce a small ordering bonus for the rooms they have not seen.

### How it works

1. **A reading is recorded** by `recordDwellAction` (`app/actions/dwell.ts`): milliseconds on the card, photos flipped, info pages opened. Below 1.5 s it is noise and is dropped; above 45 s it is capped. The strongest reading per room wins, **per column**, so a reload cannot erase a long earlier look.
2. **A room becomes a sparse feature vector** — `city:`, `type:`, `lease:`, `rent:` bucketed to ₪500, `rooms:`, `roommates:`, `area:`, `size:` bucketed to 20 m², amenity flags, `safe:`, and `photo:<label>` for each room the owner tagged a photo as. Deliberately coarse: exact values would make every room its own category and nothing would resemble anything.
3. **Engagement**, 0–1, is `0.55 × time + 0.25 × photos + 0.2 × pages`. A clock alone cannot tell interest from hesitation, so deliberate navigation corroborates it.
4. **Taste** is the sum of every seen room's features, pulled by `engagement − 0.45`. Scoring around a neutral point rather than zero means a room the seeker barely looked at pushes its features *away*.
5. **The bonus** is cosine similarity × 8 × confidence, where confidence ramps from 0 at fewer than 3 seen rooms to 1 at 12.

### The guarantee, and why it is the important part

Personalisation runs strictly **after** `getSwipeDeck`. The hard filters and the 60-point gate have already chosen the rooms; this can only change the order they arrive in. The bonus is clamped to ±8 on a 0–100 scale for the same reason: a room may climb within its band, but a merely-good room can never overtake a great one on the strength of a long look. With no history the output is byte-for-byte the compatibility ordering. `tests/unit/affinity.test.ts` asserts all of it.

`withReading` applies one fresh reading without re-reading the database, which is how the deck adapts while the seeker is still swiping.

---

## 11. AI photo verification

`lib/photo-vision.ts` (the call) + `lib/photo-check.ts` (the trust model) + `app/actions/photo-check.ts` (the action).

**The problem:** a listing whose photos do not show what they claim is worse than a listing with no photos, because the swipe deck is a photo story — living room, bedroom, bathroom, then the rest.

**The mechanism:** every photo a member picks is sent to **Gemini as inline bytes, before it is uploaded anywhere**. The model is asked what the photo actually shows; the photo reaches Supabase storage only if that matches the tag the member chose. A bedroom tagged "Living room", a dog, or a plate of food is refused and never stored.

Three details make it usable in production:

- **A model list, not a model.** `PHOTO_CHECK_MODELS` is tried in order. A member is waiting on this call, and a model answering "high demand, try again later" must not be the end of it.
- **Signed verdicts.** A verdict is an HMAC token bound to the exact URL *and* subject, minted with `GEMINI_API_KEY` as the secret. The browser carries it from the check to the publish, and `auditPhotos` re-checks every photo at publish time — so a member cannot re-tag a checked photo in the DOM and publish it under a different room. Verdicts die with the key that minted them.
- **It is optional.** `isPhotoCheckEnabled()` gates both halves. Without the key the check is off and listings save unchecked, so a clone of the repo still runs.

---

## 12. Security

Fully documented in [`docs/submission/05-security.md`](docs/submission/05-security.md); the summary:

| Concern | How it is handled |
|---|---|
| **Authentication** | Supabase Auth, mandatory email confirmation, sessions in HTTP-only cookies refreshed by `proxy.ts`. Registration returns no session. |
| **Authorisation** | 57 live RLS policies — 50 on app tables, 7 on `storage.objects` — with RLS enabled on all 21 tables. Every query runs as the caller. Three tables have no write path but a `SECURITY DEFINER` function. |
| **Input validation** | Zod at every boundary (`lib/validation/`), plus id-shape guards in the actions themselves — a forged UUID is refused before the member is even looked up. |
| **API protection** | Page routes are gated at the proxy; the two writing API routes check `getAuthContext` themselves and answer a JSON 401. Bodies are parsed defensively — a non-JSON body is a 400, not a 500. |
| **Open redirect** | `sanitizeNextPath` on every `?next=`, covering `//`, `/\`, and stripped whitespace. |
| **Secrets** | `.env*.local` gitignored; `.env.example` holds names only. `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, SMTP and Google secrets are server-only and never `NEXT_PUBLIC_`. Never passed as build arguments — build args are baked into the output. |
| **Storage** | Bucket policies key on the conversation id in the object path; the bucket's own MIME and size limits are the outer fence. `messageSchema` pins an attachment path to the caller's own conversation folder and a uuid filename. |
| **Enumeration** | Password reset always reports "sent". Sign-in gives one sentence for both wrong-password and no-such-account. Throttle rows store addresses hashed. |
| **Abuse** | Reporting, mutual blocking, and automatic suspension at a tunable threshold — immediately for `inappropriate_images`. |
| **Session hygiene** | Sign-out is a 303 with no GET handler; account deletion forces a full document load for the same reason. |

**Disclosed trade-off:** the render-time session is cached for up to five minutes, so a suspension applied mid-session takes effect within that window rather than on the very next page. Writes are unaffected — every Server Action re-checks uncached — and the proxy still verifies the session on every request.

---

## 13. Scalability

Full analysis in [`docs/submission/04-scale.md`](docs/submission/04-scale.md).

**Where the cost is.** Swipe is by far the most expensive page: roughly nine round-trips in three dependent waves. Browse is the most *frequent*.

**What is done about it:**

- **The heavy page is cached per member.** `getCachedDeck` holds the whole payload behind `deck:<id>`, invalidated on every swipe and on any publish/pause/remove by that member. Returning to Swipe costs zero requests.
- **The frequent page is cached once for everybody.** `queryListings` is the app's only shared cache, which is only sound because it runs on the cookie-free client. The per-member score is a separate private read.
- **Filtering happens in SQL, not in TypeScript.** City, budget and gender narrow the query itself; `applyListingFilters` pushes every browse filter down to PostgREST with `range()` pagination (20 per page, capped at 50).
- **Two facts are denormalised** (`household_size`, `household_gender`) so the filters they serve are indexed equalities rather than per-row subqueries.
- **The map asks for eight fields, not whole rows**, caps at 2 000 pins, and the nearby map boxes to a 10 km bounding box on indexed `lat`/`lng` columns. `/api/listings/pins` is CDN-cacheable, so most map opens never reach the database.
- **Payload discipline.** Pins are fetched on the first map open rather than shipped with the page (~150 KB saved on visits that never open it). Photos are re-encoded in the browser before upload.

**Current limits, honestly:** the deck reads the newest 300 matching rooms and returns 60. That is right for hundreds of listings and wrong for hundreds of thousands — at that size the scoring belongs in Postgres (a scored view, or pgvector for the affinity half) with the deck paginated. Realtime holds one channel per open thread, which is fine for a tab and not for a fan-out of thousands. There is no rate limiting on Server Actions beyond the auth-mail throttle.

---

## 14. Tests

**107 files, 842 tests.** Vitest 4 + React Testing Library (jsdom), plus Playwright scripts for the handful of properties that need a real browser.

The suite is weighted by failure cost: cross-member data exposure first, silent business-rule failures second, appearance last. Highlights:

- **Access control** — `cached-session-boundary.test.ts` scans the Server Actions and fails if one authorises itself with the cached session; `cache-invalidation.test.ts` asserts every per-member tag carries the acting member's id; `signout-clears-cache.test.ts` pins the 303 and the absence of a GET handler.
- **Scoring** — `compatibility.test.ts` for each weighted row, `compatibility-invariants.test.ts` for the scale itself (a perfect fit is exactly 100, so the weights still sum to 100; 3 000 randomised pairings all land as whole numbers in 0–100 and spread across all four bands).
- **Business rules** — a swiped room never returns; a like is mirrored into the hearts; deleting an account transfers a shared listing; a blocked member vanishes in both directions; every one of the 124 cities can fill a deck.
- **Invalid input** — every Zod schema, and `?rent_max=banana` style junk proven to fall back to a default rather than a 500.
- **Database** — a sha256 fingerprint over the seed fixtures; migration promises read back out of the SQL.

Full breakdown, per category, in [`TEST_PLAN.md`](TEST_PLAN.md).

```bash
npm test                              # the suite
npm test -- --testTimeout=25000       # if a synchronising folder starves userEvent
npx tsc --noEmit                      # types
npm run lint                          # ESLint
```

---

## 15. Known limitations

Stated plainly.

**Product**

- One active listing per member. Right for the flatshare case, wrong for a landlord with a portfolio.
- No payments, no lease signing, no identity verification. NestUp ends at "you have met and it fits".
- Cities are a fixed list of 124 Israeli towns (`lib/cities.ts`). Adding a country means new coordinates and new spellings.
- No push notifications — only email, and only for new matches.
- No admin interface. Suspension is automatic from reports; lifting one is a SQL statement.

**Technical**

- The deck reads the newest 300 matching rooms; scoring is in TypeScript, not SQL (§13).
- `lib/types.ts` is hand-maintained rather than generated from the schema, so a migration and its types can drift until the build catches it.
- Four migration numbers are used twice (`0035`–`0038`), from parallel work. Filename order is still correct, but the numbering no longer reads as a clean sequence.
- Geocoding depends on Nominatim, a volunteer service. A room whose address cannot be placed simply gets no map.
- "What's nearby" depends on Overpass mirrors and fails to an empty list by design.

**Testing**

- RLS policies are not exercised by the unit suite — it mocks the Supabase client. They are covered by real-browser checks, by reading the SQL back in `moderation.test.ts`, and by review.
- There is no automated end-to-end journey covering registration → profile → swipe → chat → viewing.
- Email delivery, the Gemini model's judgement, and Google Calendar sync are verified by hand.
- Load has never been measured; the reasoning in §13 is analytical.

---

*Companions: [Local Setup](LOCAL_SETUP.md) · [Test Plan](TEST_PLAN.md) · [Product Spec](docs/submission/01-product-spec.md) · [Technical Design](docs/submission/02-technical-design.md) · [Scale](docs/submission/04-scale.md) · [Security](docs/submission/05-security.md)*

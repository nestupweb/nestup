# NestUp — Test Plan

**Scope:** what has to be true for NestUp to be considered working, how each of those things is checked, and what is deliberately left unchecked.

**Suite:** 107 test files · 842 tests · Vitest 4 + React Testing Library (jsdom) + Playwright (real browser, targeted scripts)
**Run:** `npm test` — never a bare `npx vitest run`; see [§9](#9-running-the-suite).

> A companion, narrative version of this document lives at [`docs/submission/03-test-spec.md`](docs/submission/03-test-spec.md). This file is the plan itself: the categories the assignment asks for, the rule each test defends, and the file it lives in.

---

## 1. What "working" means here

Before listing tests it is worth saying what the suite is defending, because that is what decides where the effort goes. NestUp can fail in three ways that matter, in descending order of cost:

| # | Failure | Cost | Test weight |
|---|---|---|---|
| 1 | **A member sees another member's data.** | Unrecoverable — the whole trust proposition of a roommate-matching product collapses. | Heaviest. Access control is tested at every layer the unit suite can reach, and the layers it cannot reach are named in [§10](#10-known-gaps). |
| 2 | **A core flow silently does the wrong thing.** A message that never arrives; a swiped room that comes back; an edit to a listing that also wipes the owner's chats. | Expensive — it is invisible until a member complains. | Heavy. Every business rule in [§4](#4-business-process-tests) has a test that fails if the rule changes. |
| 3 | **A screen is wrong or ugly.** | Cheap — it is caught by looking at it. | Light, and behavioural: which control appears, what state it is in, where it navigates, what it renders when data is missing ([§8](#8-basic-ui-tests)). |

**Deliberately not tested:** every line of every component, exact copy, exact colours (except where a rule depends on one — `map-basemap.test.ts`), and third-party libraries. A suite that asserts on wording becomes a suite nobody is willing to change.

---

## 2. Feature tests — the main flows

### 2.1 Authentication and onboarding

| Rule | Test file |
|---|---|
| Sign-up and sign-in forms: field state, submission, error display | `auth-form.test.tsx` |
| **Registration must not return a usable session** — the row is created, a code is mailed, access waits for confirmation | `signup-confirmation.test.ts` |
| Sign-in refuses a malformed address or empty password *before* Supabase is asked; a wrong password and an unknown address return the **same** sentence (no account enumeration); an unconfirmed address gets its own message | `sign-in-action.test.ts` |
| A successful sign-in drops the cached "nobody" (`SESSION_TAG`) before it navigates, and `?next=` is sanitised so the login form cannot be used as an open redirect | `sign-in-action.test.ts` |
| A suspended account is signed back out with the exact wording | `moderation.test.ts` |
| Forgot-password and reset flows | `auth-password-actions.test.ts` |
| Every shape of emailed link lands correctly: signup → onboarding, recovery → reset, invalid → `/login` with a notice | `auth-confirm-route.test.ts` |
| Mail templates, the sender, and the per-address throttle that replaces GoTrue's rate limit | `auth-email-templates.test.ts`, `auth-mail.test.ts`, `mail.test.ts` |
| Show/hide password toggle | `password-input.test.tsx` |
| `sanitizeNextPath` itself | `redirect.test.ts` |

### 2.2 Profile and personalisation inputs

| Rule | Test file |
|---|---|
| Saving a profile writes the right rows and invalidates the right caches | `profile-action.test.ts` |
| Which fields block a save, and the banner that explains it | `profile-required-fields.test.tsx` |
| A rejected form keeps everything typed (React 19 resets forms by default) | `profile-form-sticky.test.tsx`, `sticky-form.test.tsx` |
| Private details, contact visibility, the Daily-life questionnaire and its reminder | `about.test.tsx`, `contact-row.test.tsx`, `daily-life.test.tsx`, `daily-life-reminder.test.tsx` |
| Preference inputs: amenities, mamad, interests | `profile-amenities.test.tsx`, `interests-picker.test.tsx` |
| Avatar upload, photo ordering, the lightbox | `profile-avatar.test.tsx`, `photo-picker.test.tsx`, `photo-order.test.ts` |
| Profile tabs, My Listing, another member's public profile | `profile-tabs-history.test.tsx`, `my-listing.test.tsx`, `people.test.ts` |

### 2.3 Listings

| Rule | Test file |
|---|---|
| The browse query: filters → SQL, sorting, pagination arithmetic | `listing-query.test.ts` |
| `GET /api/listings` turns a raw query string into filters and echoes the page it served | `listings-api.test.ts` |
| `GET /api/listings/pins` answers with pins, a count, and a CDN-cacheable header | `listings-api.test.ts` |
| Publishing, pausing, resuming, soft removal | `listing-actions.test.tsx`, `listing-status-action.test.ts`, `delete-listing-action.test.ts` |
| The "taken" state and the notice it sends | `mark-taken.test.tsx`, `listing-taken.test.ts` |
| How a room is presented: generated title, tile, gallery | `listing-title.test.ts`, `property-tile.test.tsx`, `listing-gallery.test.tsx` |
| Filter and sort controls | `filter-bar.test.tsx`, `sort-menu.test.tsx` |
| Hearts, signed in and signed out | `save-button.test.tsx` |
| Household composition rules | `roommate-tag-picker.test.tsx`, `roommate-count.test.tsx`, `roommates-fit-rooms.test.ts` |
| Co-ownership and invitations | `co-posters.test.ts`, `co-posters-action.test.ts`, `co-poster-invites.test.tsx` |
| The invitation API: Yes/No carried to `respond_to_listing_invite`, and the database's own refusal statuses (409 answered twice, 403 not yours) passed straight through | `invites-api.test.ts` |
| Address → point, and the map around a room | `geo.test.ts`, `nearby-pins.test.ts`, `map-explorer.test.tsx`, `room-map-button.test.tsx` |

### 2.4 Matching, swipe, likes

| Rule | Test file |
|---|---|
| The scoring function, component by component, including the "unset preference ≈ 60%" convention | `compatibility.test.ts` |
| Scale properties: every score is a whole number in 0–100, a perfect fit is **exactly** 100 (the weights still sum to 100), and the sweep spreads across all four bands instead of collapsing | `compatibility-invariants.test.ts` |
| Deck ordering, the hard filters, and the `MIN_DECK_SCORE` gate | `swipe-rank.test.ts` |
| The gate and the label are the same threshold — nothing below "Good" reaches a deck | `compatibility-invariants.test.ts` |
| The deck UI: like, skip, the intro sheet, the empty state | `swipe-deck.test.tsx` |
| **A like is written to `swipes` *and* mirrored into `saved_listings`**, so the deck heart and the Listings heart agree; a skip is not | `swipe-like-actions.test.ts` |
| Unliking deletes that member's own row and only that one | `swipe-like-actions.test.ts` |
| The hello after a like: opens or reuses the thread, posts, marks its own copy read | `intro-action.test.ts` |
| Interest overlap → social score | `affinity.test.ts`, `compatibility.test.ts` |
| One preferred city is the whole requirement for a deck | `apartment-prefs.test.ts`, `no-city-prompt.test.tsx` |
| **The real deck is measured across all 124 cities**, so no town can silently become unmatchable | `seed-data.test.ts` |
| A newly published room is emailed only to members whose deck it would have reached | `notify.test.ts` |

### 2.5 Attention-based personalisation

| Rule | Test file |
|---|---|
| What a reading is worth (time, photos flipped, pages opened), and the taste vector built from it | `affinity.test.ts` |
| **The guarantee:** personalisation only reorders — it never admits, drops or duplicates a room, and the bonus is clamped to ±8 on a 0–100 scale | `affinity.test.ts` |
| The write path: the client's numbers are re-clamped server-side to the same ceilings migration `0035` enforces | `dwell-action.test.ts` |
| A glance below the noise floor is not evidence; the boundary is inclusive | `dwell-action.test.ts` |
| **The strongest reading wins, per column** — a reload cannot erase a long earlier look | `dwell-action.test.ts` |

### 2.6 Chat and viewings

| Rule | Test file |
|---|---|
| Sending a message, and the idempotent retry of an identical `client_id` | `send-message-action.test.ts` |
| **One thread per (room, seeker):** an existing thread is reused, and losing the insert race re-reads the winner's row instead of failing | `conversation-race.test.ts` |
| The realtime token reaches the socket before the channel joins; one invalidation per burst | `chat-realtime.test.tsx` |
| The per-member "delete chat" cutoff | `chat-visible.test.ts` |
| Optimistic sending, attachments, formatting | `chat-outbox.test.ts`, `message-composer.test.tsx`, `chat-media.test.ts`, `chat-format.test.ts` |
| "Message the household" entry point | `message-owner.test.tsx` |
| Proposing, approving, availability windows, calendar export | `viewing-card.test.tsx`, `viewing-details.test.tsx`, `availability.test.ts`, `calendar.test.ts` |

### 2.7 Settings, moderation, account

| Rule | Test file |
|---|---|
| Changing email and password | `account-actions.test.ts`, `account-section.test.tsx` |
| Account deletion, **including the listing-handover picker in all three shapes** (no heir, one heir, several) | `danger-zone.test.tsx` |
| Settings controls | `setting-toggle.test.tsx`, `settings-gear.test.tsx` |
| Reporting, blocking, unblocking, suspension | `moderation.test.ts` |

---

## 3. Invalid-input tests

Every input reachable from a browser is either validated by a Zod schema or refused by a guard before it touches the database. This is what proves it.

| Input | What is asserted | Test file |
|---|---|---|
| Every Zod schema | Required fields, lengths, ranges, enums, coercion, cross-field refinements (`budget_max ≥ budget_min`, roommates ≤ rooms) | `validation.test.ts` |
| A profile missing a basic | Refused with a **field-level** message, and *all* missing fields named at once, not just the first | `validation.test.ts`, `profile-required-fields.test.tsx` |
| Sign-in | Missing address, address with no domain, address with a space, empty password — none becomes a login attempt | `sign-in-action.test.ts` |
| Messages | Empty, over-length, malformed conversation id, and a photo path outside the conversation's own folder (`../etc/passwd`, a second `video/` level, a non-uuid filename) | `validation.test.ts`, `send-message-action.test.ts` |
| Query strings | Junk **never** becomes a 500: `?rent_max=banana`, `?page=-5`, `?page_size=9999`, `?sort=cheapest`, `?city=Paris`, `?move_in_by=2026-13-45`, and all of them at once, each fall back to a default | `listings-api.test.ts`, `listing-query.test.ts` |
| Swipe / like / dwell | A forged room id or an unknown direction is refused **before the member is even looked up** | `swipe-like-actions.test.ts`, `dwell-action.test.ts` |
| Dwell readings | Forged numbers are clamped, negatives and `NaN` become 0, fractions are rounded | `dwell-action.test.ts` |
| Intro template | Longer than the field allows is refused before the write; empty is a real answer | `intro-action.test.ts` |
| Form controls | Non-numeric rent, malformed phone numbers, impossible dates, unknown cities | `amount-input.test.tsx`, `phone-field.test.tsx`, `date-picker.test.tsx`, `city-combobox.test.tsx` |
| Photos | Wrong file type, oversized file, and a photo whose **content** does not match its tag | `photo-rules.test.ts`, `photo-check.test.ts`, `photo-picker.test.tsx` |
| Redirect targets | `?next=https://evil.example`, `//evil.example`, `/\evil.example`, and a tab smuggled into a protocol-relative URL | `redirect.test.ts`, `sign-in-action.test.ts` |
| Image conversion | Client-side compression and HEIC conversion boundaries | `image-client.test.ts` |
| Invitations | A forged invite id, an answer that is neither yes nor no, answering twice | `co-posters-action.test.ts` |
| Invitation API bodies | A body that is not JSON, one with no `status`, an unknown `status`, and the right word in the wrong case — each a **400 with a sentence**, never a 500 | `invites-api.test.ts` |

---

## 4. Business-process tests

These assert the rules that make the *product* correct, not merely the code.

| Rule | Where it is asserted |
|---|---|
| A swiped room never returns to the deck | `swipe-rank.test.ts`, `swipe-like-actions.test.ts`, `cache-invalidation.test.ts` |
| Only rooms scoring 60+ combined enter the deck; the rest stay reachable through Listings | `swipe-rank.test.ts`, `compatibility-invariants.test.ts` |
| A seeker who has named no city gets no deck | `apartment-prefs.test.ts` |
| A like in the deck and a heart in Listings are the same thing | `swipe-like-actions.test.ts` |
| A room the seeker liked opens exactly one conversation, however many times Send is tapped | `conversation-race.test.ts` |
| Personalisation can reorder a deck but never change its membership | `affinity.test.ts` |
| One person, one active listing | `roommates-fit-rooms.test.ts`, `co-posters.test.ts` |
| Roommates cannot exceed the rooms they would live in | `roommates-fit-rooms.test.ts` |
| Deleting an account **transfers** a shared listing rather than destroying it | `danger-zone.test.tsx` |
| A member who already has a live listing cannot inherit a second one | `danger-zone.test.tsx` |
| Deleting a chat hides it for one side only; the next message restores it | `chat-visible.test.ts` |
| A blocked member disappears from decks and search in both directions | `moderation.test.ts` |
| A retried message with the same `client_id` is not posted twice | `send-message-action.test.ts` |
| A new-listing email can never advertise a room the deck itself would have filtered out | `notify.test.ts` |
| Every one of the 124 cities can fill a deck | `seed-data.test.ts` |

### Cache invalidation, treated as a business rule

`cache-invalidation.test.ts` asserts the **blast radius** of every mutation: that liking a room touches exactly `saved:<me>` and `profile:<me>`; that no listing mutation reaches into chat; that no chat mutation reaches into the deck or the room list.

This exists because of a real defect. Mutations used to answer every write with a fistful of `revalidatePath` calls, so editing a room also discarded that member's chats and profile. The test encodes the rule that replaced it.

---

## 5. Permission tests

The highest-value category, because the worst failure mode of this product is one member seeing another's data.

| Rule | Test file |
|---|---|
| **Every per-member cache tag carries the acting member's id.** A tag that omitted it would become one shared cache key for the whole application — which is exactly the shape a cross-user leak takes | `cache-invalidation.test.ts` |
| **No Server Action may authorise itself with the cached session.** Identity is cached for *rendering* only; every write re-checks uncached. Both spellings compile, so only a test can enforce this boundary | `cached-session-boundary.test.ts` |
| The cached session still reads the `suspensions` table, and both render-time gates still redirect on it | `cached-session-boundary.test.ts` |
| **Signing out answers 303**, forcing a full document load — the only thing that empties browser-held private caches — and there is **no GET handler**, so a logout cannot be triggered from another site | `signout-clears-cache.test.ts` |
| Log out posts to the route handler, not a Server Action (a soft redirect would leave the caches alive) | `member-actions.test.tsx` |
| A member cannot lift their own suspension; blocking is mutual | `moderation.test.ts` |
| The "linked to this room" listing exception cannot be used to see past a block | `moderation.test.ts` |
| Only the owner can edit a profile | `profile-action.test.ts` |
| Only the invitee can accept an invitation; over-cap tagging is a 422, tagging a blocked member a 403 | `co-posters-action.test.ts` |
| A dwell row is written for the **signed-in** member, whoever the caller claims to be | `dwell-action.test.ts` |
| An unlike deletes scoped by both `user_id` and `listing_id` | `swipe-like-actions.test.ts` |
| `GET /api/invites` and `PATCH /api/invites/:id` answer a JSON **401** without a session — the middleware guards page routes only — and never attempt the write | `invites-api.test.ts` |
| The invitations endpoint publishes four listing fields, not the whole row it fetched | `invites-api.test.ts` |

**The layer these cannot reach** is RLS itself, which Postgres enforces while the unit suite mocks the Supabase client. RLS is covered instead by the real-browser checks in [§7](#7-edge-cases) and by the fact that the policies are the *only* path to the data — see [`SYSTEM_GUIDE.md § Security`](SYSTEM_GUIDE.md#12-security) and [`docs/submission/05-security.md`](docs/submission/05-security.md).

---

## 6. Database tests

| Rule | Test file |
|---|---|
| A **sha256 fingerprint over the first 92 seed records**, so re-running `npm run seed` can never silently alter existing demo data | `seed-data.test.ts` |
| Deck coverage re-measured across all 124 cities with the real `buildDeck` | `seed-data.test.ts` |
| All 124 generated city coordinates are protected against drift, and each sits inside the country | `city-centres.test.ts` |
| Filters → SQL, including the `range()` arithmetic behind pagination | `listing-query.test.ts` |
| Every `cacheLife` declares `stale ≥ 300s` (the App Shell threshold), and the router cache is not shorter than the data caches | `cache-lifetimes.test.ts` |
| The denormalised household columns maintained by triggers (`household_size`, `household_gender`) | `roommates-fit-rooms.test.ts`, `roommate-count.test.tsx` |
| Migration promises read straight from the SQL: `suspensions` has a read policy and **no write policy at all**; one report per reporter per subject is a database constraint; the suspension threshold is a tunable row, not a literal | `moderation.test.ts` |
| Upsert conflict targets are the ones the unique constraints define (`seeker_id,listing_id`, `user_id,listing_id`) | `swipe-like-actions.test.ts`, `dwell-action.test.ts` |
| The unique constraint on `(listing_id, seeker_id)` is survivable — a lost race re-reads rather than failing | `conversation-race.test.ts` |

---

## 7. Edge cases

| Case | Test file |
|---|---|
| An empty deck — everything swiped, or nothing reaching 60 | `swipe-deck.test.tsx`, `swipe-rank.test.ts` |
| An empty inbox; a chat deleted and revived by a new message | `chat-visible.test.ts` |
| A room removed while a conversation about it is open | `listing-taken.test.ts` |
| Two tabs opening the same conversation at the same instant | `conversation-race.test.ts` |
| A room that can no longer receive messages (pulled or paused between deck and hello) | `intro-action.test.ts` |
| A duplicated message send | `send-message-action.test.ts` |
| A dwell reading arriving for a room that has since been removed | `affinity.test.ts` |
| Account deletion with zero, one, or several eligible heirs | `danger-zone.test.tsx` |
| The realtime socket joining before the token arrives; a failed sync must not throw inside an effect | `chat-realtime.test.tsx` |
| A stale `?needs=cities` left in the URL after the member has fixed it | `no-city-prompt.test.tsx` |
| A listing with no photographs | `listing-gallery.test.tsx` |
| A geocoder that is busy vs. one that says "no such address" | `geo.test.ts` |
| An Overpass mirror that will not answer — the map still opens on the room | `map-explorer.test.tsx`, `room-map-button.test.tsx` |
| Navigation must stay in one tab | `same-tab-navigation.test.ts` + `npm run check:nav` |

### Real-browser checks (Playwright)

Some properties cannot be asserted in jsdom — they need a real engine, a real GPU canvas, or the real deployment.

| Script | What it proves |
|---|---|
| `npm run check:map` | Both themes render; red pixels are counted **directly from the WebGL canvas**, because a GL layer has no DOM to query |
| `npm run check:nav` | No internal link opens a new tab |
| `npm run check:cursors` | Interactive elements carry the cursor they claim to |
| `.superpowers/e2e/nav-cache.mjs` | **21 assertions against the live site:** signing out destroys the JS context; `/swipe` redirects after a logout; the back button cannot restore a signed-in page; a second member in the same tab sees only their own data |
| `.superpowers/e2e/chat-freshness.mjs` | A real message reaches the thread *and* updates the cached inbox row, and survives navigating away and back |
| `.superpowers/e2e/skeleton-duration.mjs` | Measures how long each loading skeleton is actually on screen, per tab |

> The `.superpowers/` scripts are gitignored working tools, not part of the committed suite. `npm run check:*` are committed and runnable from a clone.

---

## 8. Basic UI tests

The interface is tested for what it *does*. Each runs in React Testing Library against real user events — clicks, typing, arrow keys, Escape.

### Navigation chrome

| Rule | Test file |
|---|---|
| Four destinations render, the current one is marked, nested routes keep their tab active, the unread badge appears inside the Chat link and nowhere else, the bar hides on a small screen inside an open thread and on auth pages | `bottom-nav.test.tsx` |
| The back button names the page it returns to, pops the in-app trail instead of growing it, survives a reload via `sessionStorage`, and falls back to the list page | `back-button.test.tsx` |
| Moving right along the tab bar is forward, left is back — which drives the transition animation | `nav-direction.test.ts` |
| Every internal link stays in the same tab | `same-tab-navigation.test.ts` |

### Form controls

| Rule | Test file |
|---|---|
| `dd/mm/yyyy` inserts its own slashes and caps each field; impossible dates are refused; the calendar blocks days before `min` and outside allowed weekdays; typing cannot bypass a blocked day | `date-picker.test.tsx` |
| Thousands are grouped while typing but submitted bare; an empty field submits nothing rather than a zero; the caret stays put when a comma appears to its left | `amount-input.test.tsx` |
| A country is searched like a city (type, arrow, Enter); the flag and dial code follow; a stored international number pre-selects its country; Escape closes the list | `phone-field.test.tsx` |
| The chevron opens every city A–Z grouped by letter; typing filters to *every* match, not the first eight | `city-combobox.test.tsx` |
| A rejected form keeps every value the member typed | `sticky-form.test.tsx`, `profile-form-sticky.test.tsx` |

### Theme and appearance

| Rule | Test file |
|---|---|
| The theme control is a real switch, flips `dark` on `<html>`, persists to `localStorage`, and reports the right state when the page loads already dark | `theme-toggle.test.tsx` |
| Both themes resolve to the correct basemap (verified against a real GPU canvas by `npm run check:map`) | `map-basemap.test.ts` |
| The served MapLibre worker matches the installed `maplibre-gl` | `maplibre-worker.test.ts` |

### Empty, missing and degraded states

| Rule | Test file |
|---|---|
| A room with no photographs still renders | `listing-gallery.test.tsx` |
| An exhausted deck shows its empty state, not a blank screen | `swipe-deck.test.tsx` |
| A Listings row shows the same two scores as the deck; a `null` social score degrades to an em dash, not a zero; a signed-out visitor sees no score pills at all; a low score is shown rather than hidden | `listing-match-score.test.tsx` |
| A plain tile is just a link; a liked tile carries a filled heart that toggles on tap **without** following the link underneath | `property-tile.test.tsx` |
| The map opens on demand, its legend names only the categories present, a failed lookup offers a retry, and closing works by button, Escape and backdrop with focus returning to the trigger | `room-map-button.test.tsx`, `map-explorer.test.tsx` |

---

## 9. Running the suite

```bash
npm test                              # 107 files, 842 tests
npm test -- --testTimeout=25000       # use this if userEvent tests time out (below)
npm test -- swipe-rank                # one file, by name fragment
npx tsc --noEmit                      # types
npm run lint                          # ESLint
```

Two environment traps, both worth knowing before treating a red result as genuine:

1. **Always `npm test`, never `npx vitest run`.** The npm script sets `NODE_OPTIONS=--no-experimental-webstorage`. Without it, Node 25 installs its own inert `localStorage` global that jsdom does not replace, and `theme-toggle.test.tsx` fails with `localStorage.clear is not a function` — a failure that says nothing about the component.
2. **A synchronising folder starves `userEvent`.** When the working copy lives in OneDrive/Dropbox and the client is busy, roughly half a dozen interaction tests exceed the default 5-second limit. Re-run with `--testTimeout=25000` before believing a timeout.

---

## 10. Known gaps

Stated plainly, because a test document claiming complete coverage is not credible.

- **RLS policies are not exercised by the unit suite.** The suite mocks the Supabase client, so the policies themselves are covered only by the real-browser checks, by reading the SQL back in `moderation.test.ts`, and by manual review. The right fix is a test that runs real queries as two different members against a dedicated test project.
- **There is no automated end-to-end journey.** Playwright is used for targeted checks, not a full script covering registration → profile → swipe → chat → viewing.
- **Email delivery is mocked.** Templates and the sender are tested; arrival in an inbox is checked by hand.
- **The Gemini photo check is mocked.** Its contract is tested; the model's judgement is not. `npm run check:photos` probes the real model manually.
- **Load has not been measured.** The reasoning about scale is analytical — see [`docs/submission/04-scale.md`](docs/submission/04-scale.md).
- **Google Calendar sync is untested.** The OAuth callback and token exchange are exercised by hand only.

---

*Companion documents: [System Guide](SYSTEM_GUIDE.md) · [Local Setup](LOCAL_SETUP.md) · [Product Spec](docs/submission/01-product-spec.md) · [Technical Design](docs/submission/02-technical-design.md) · [Scale](docs/submission/04-scale.md) · [Security](docs/submission/05-security.md)*

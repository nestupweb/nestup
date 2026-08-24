# NestUp — Design Document

**Date:** 2026-08-24
**Course:** Internet Technologies — Become a Full-Stack Engineer, RUNI CS 2026 (final project, due 2026-09-06)
**Stack (mandated):** Next.js · TypeScript · Supabase (DB + Auth + Storage + Realtime) · Vercel

---

## 1. Product summary

NestUp is a two-sided marketplace for finding shared apartments and roommates. Seekers swipe through available rooms dating-app style; listers post a room in their apartment and review interested seekers. A mutual like creates a match, which opens an in-app chat.

- **Problem:** finding a roommate today happens in chaotic Facebook groups and listing boards with no structure, no compatibility signal, and no privacy.
- **Users:** young renters (students, young professionals) looking for a room, and people with a spare room looking for a compatible roommate.
- **Business value:** saves both sides time, increases the quality of roommate decisions via a transparent compatibility score, and keeps contact details private until both sides opt in.

### Decisions log (approved during brainstorming)

| # | Decision |
|---|----------|
| 1 | Two-sided marketplace with **mutual matching** — every user can be seeker, lister, or both |
| 2 | After a match, communication is **in-app chat** (no external contact reveal) |
| 3 | UI language: **English** (LTR); Israeli cities as content |
| 4 | Architecture: **server-first Next.js App Router + Supabase RLS** |
| 5 | **Listings are public** (anonymous visitors can browse & filter); **Swipe requires sign-in** |
| 6 | **Compatibility scores never filter** — they inform and sort only; both sides always decide manually |
| 7 | Visual design: **Editorial (light) as default theme, Noir (dark) as opt-in dark mode** |
| 8 | **Two compatibility scores**: Lifestyle (habits + preferences) and Social (shared interests) |
| 9 | **Email confirmation ON**: users must confirm their email before first sign-in (signup shows a "check your inbox" state; `/auth/confirm` route verifies the token). Caveat: Supabase's built-in mailer is dev-grade and rate-limited — documented in the scale/security docs; custom SMTP is the production path. |

---

## 2. Screens & user flows

### Core flow (the money flow)

```
Sign up → Create profile → Swipe on rooms → Lister sees "Interested" queue
       → Lister likes back → MATCH → In-app chat
```

### Screens (6)

1. **Auth** — sign up / log in with Supabase Auth (email + password). New users are redirected to profile creation before anything else.
2. **Profile** — create/edit: photo, full name, age, occupation, bio; lifestyle habits (smoker, has pet, cleanliness 1–5, sleep schedule, guest frequency); **interests** (3–10 tags from a fixed list, feeds the Social score); roommate preferences (ok with smoker, ok with pets); apartment preferences (budget min–max, preferred cities, earliest move-in).
3. **Swipe** (auth required) — card deck of active listings, sorted by compatibility score descending, excluding the user's own listing and already-swiped listings. Card shows: photo carousel, compatibility tag, title, rent, city/neighborhood, move-in date, spec line (flatmates count · pets · smoking), feature list, current-roommate row. Swipe right = like, left = skip (buttons + drag gesture).
4. **Browse Listings** (public) — filterable list/grid: city, rent range, move-in date, number of roommates, pets allowed, smoking allowed, features. Tap opens listing detail. Anonymous visitors see roommate *count* but not personal roommate profiles; tapping "Like" while anonymous redirects to sign-in.
5. **My Listing** (auth required) — create/edit the user's room listing (title, description, city, neighborhood, rent, available-from, roommates count, rules, features, up to 5 photos, active toggle) and the **Interested queue**: seeker profiles who liked the listing, sorted by the lister's directional compatibility score, each with "Like back" (creates match) or "Skip".
6. **Matches & Chat** (auth required) — list of matches; each opens a chat thread (Supabase Realtime).

### Navigation

Mobile-first bottom tab bar, always visible: **Swipe · Browse · Matches · Listing · Profile**. On desktop the same nav renders as a top bar; content constrained to a centered column.

---

## 3. Data model (Supabase / Postgres)

### Tables

**profiles** — 1:1 with `auth.users`
- `user_id uuid PK` (= auth.users.id), `full_name text`, `age int CHECK (age >= 18)`, `occupation text`, `bio text`, `avatar_url text`
- Lifestyle: `smoker bool`, `has_pet bool`, `cleanliness int CHECK 1..5`, `sleep_schedule enum('early','late','flexible')`, `guests_freq enum('rare','sometimes','often')`
- Interests: `interests text[]` — chosen from a fixed app-defined tag list (~20 tags, e.g., Music, Cooking, Fitness, Gaming, Movies & TV, Reading, Travel, Hiking, Nightlife, Art, Photography, Tech, Sports, Board games, Yoga, Running, Concerts, Vegan food, Volunteering, Languages); pick 3–10
- Roommate prefs: `ok_with_smoker bool`, `ok_with_pets bool`
- Apartment prefs: `budget_min int`, `budget_max int CHECK (budget_max >= budget_min)`, `preferred_cities text[]`, `earliest_move_in date`
- `created_at`, `updated_at`

**listings**
- `id uuid PK`, `owner_id uuid FK → profiles`, `title text`, `description text`, `city text`, `neighborhood text`, `rent int CHECK (rent > 0)`, `available_from date`, `roommates_count int`, `pets_allowed bool`, `smoking_allowed bool`
- Features: `balcony bool`, `air_conditioning bool`, `parking bool`, `elevator bool`, `furnished bool`
- `photo_urls text[]` (max 5), `is_active bool default true`, `created_at`, `updated_at`
- One active listing per user (v1 simplification): partial unique index on `owner_id WHERE is_active`.

**swipes**
- `id uuid PK`, `seeker_id uuid FK → profiles`, `listing_id uuid FK → listings`, `direction enum('like','skip')`, `lister_response enum('pending','liked','skipped') default 'pending'`, `created_at`
- `UNIQUE (seeker_id, listing_id)` — one swipe per seeker per listing.
- A `like` puts the seeker in the lister's Interested queue; `lister_response = 'liked'` triggers match creation (server-side).

**matches**
- `id uuid PK`, `listing_id uuid FK`, `seeker_id uuid FK`, `lister_id uuid FK`, `created_at`
- `UNIQUE (listing_id, seeker_id)`. Created **only** by server logic on mutual like — clients cannot insert.

**messages**
- `id uuid PK`, `match_id uuid FK → matches`, `sender_id uuid FK → profiles`, `content text CHECK (length 1..2000)`, `created_at`
- Realtime enabled on this table for live chat.

### Storage buckets

- `avatars/` — one profile photo per user, path `{user_id}/…`
- `listing-photos/` — up to 5 per listing, path `{user_id}/…`
- Policies: public read (listings are public; avatars render in authed screens), write/delete only within your own folder, size/type limits enforced in the upload action.

---

## 4. Permissions (Row Level Security)

| Data | Anonymous | Signed-in | Write |
|---|---|---|---|
| listings | ✅ read active | ✅ read active | owner only (insert/update/deactivate) |
| Swipe screen + swipes | 🚫 redirect to sign-in | own swipes; lister reads likes on own listing | seeker inserts own swipe; lister may update **only** `lister_response` on own listing's swipes |
| profiles | 🚫 | ✅ read (roommate rows, Interested queue) | own row only |
| matches | 🚫 | participants only | server only (service role / security-definer function) |
| messages | 🚫 | participants of the match only | participants insert with `sender_id = auth.uid()` |

Notes:
- RLS is enabled on **every** table; policies above are the authorization backbone. Server actions re-check ownership as defense in depth.
- Match creation runs in a single transaction: verify the swipe is a `like` on a listing the caller owns → set `lister_response` → insert match. Implemented as a Postgres function (`security definer`) called from the server action, so no client can forge a match.
- Public Browse never exposes roommate personal profiles to anonymous visitors — only counts and listing data.

---

## 5. Compatibility scores (two)

Rule-based, transparent, computed in TypeScript (pure functions, heavily unit-tested). Every card shows **two scores side by side**: **Lifestyle** and **Social**.

### 5a. Lifestyle score

**Seeker → listing** (shown on swipe cards and Browse):
| Component | Weight |
|---|---|
| Budget fit (rent within seeker's budget; partial credit near range) | 25 |
| City preference match | 20 |
| Move-in date fit (listing availability vs. seeker's earliest move-in) | 15 |
| Smoking compatibility (seeker smoker ↔ listing smoking_allowed; seeker ok_with_smoker ↔ lister smoker) | 10 |
| Pets compatibility (seeker has_pet ↔ pets_allowed; ok_with_pets ↔ lister has_pet) | 10 |
| Cleanliness similarity (|seeker − lister| on 1–5 scale) | 10 |
| Sleep schedule match | 5 |
| Guests habits match | 5 |

**Lister → seeker** (shown in the Interested queue): same components evaluated from the lister's perspective (listing rules + lister lifestyle vs. seeker profile).

### 5b. Social score (shared interests)

Measures how much the seeker and the lister would *enjoy living together*, independent of practical fit.

- Formula: `100 × |shared interests| / min(|seeker interests|, |lister interests|)` — full containment of the smaller set scores 100.
- Symmetric by nature (both sides see the same number).
- If either side picked no interests, the score shows as **“—”** with a hint (“Add interests to see social match”) rather than a misleading 0.

### Shared rules

- Output 0–100 with labels: **Great fit ≥ 80 · Good 60–79 · Fair 40–59 · Low < 40** (both scores).
- **Lifestyle scores are directional** — the two sides may see different numbers; the social score is symmetric.
- **Neither score filters or hides anyone** (approved rule): the deck shows all eligible listings and the Interested queue shows all likers. Sorting uses the average of the two scores (lifestyle only when social is “—”), with both scores displayed. Humans decide; a match still requires both sides to say yes.
- Card UI: the photo tag shows both, e.g., `92 LIFESTYLE · 78 SOCIAL`; tapping/expanding a card reveals the shared interests themselves.

---

## 6. Architecture

**Server-first Next.js App Router + Supabase RLS.**

- **Reads:** Server Components fetch via the Supabase server client (`@supabase/ssr`, cookie-based session). RLS shapes what each request can see.
- **Mutations — Server Actions:** `upsertProfile`, `createListing`, `updateListing`, `uploadPhoto`, `swipe(listingId, direction)`, `respondToInterest(swipeId, response)` (creates the match transactionally), `sendMessage(matchId, content)`. Each action: authenticate → validate with Zod → execute → `revalidatePath`.
- **API route handlers:** `GET /api/listings` — public browse endpoint with URL query filters (city, rent range, move-in, roommates, pets, smoking, features) and pagination. This is the documented "API" surface for the assignment.
- **Realtime:** the chat screen subscribes to `messages` inserts for its match (initial page server-fetched, live updates client-side).
- **Auth:** Supabase Auth email/password via `@supabase/ssr`; middleware protects `/swipe`, `/matches`, `/listing`, `/profile` routes and redirects anonymous users to `/login`; `/browse` and `/` stay public.
- **Secrets:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to expose, RLS-protected), `SUPABASE_SERVICE_ROLE_KEY` (server-only, used solely inside the match-creation path if not using the security-definer function). All in Vercel env vars, never committed.

### State management

Deliberately minimal: server data lives in Server Components + revalidation. Client state is local React state only — deck index and optimistic swipe animation, form inputs, filter UI, chat message list fed by the Realtime subscription, theme choice. No global state library; nothing here needs one.

### Project structure (planned)

```
app/
  (public)/            landing + browse + listing/[id]
  (auth)/login, signup
  (app)/swipe, matches, matches/[id], listing, profile
  api/listings/route.ts
components/            ui/ (design system), swipe/, listings/, chat/, profile/
lib/                   supabase/ (server, client, middleware), compatibility.ts,
                       validation/ (zod schemas), types.ts
supabase/              migrations/ (SQL: tables, RLS, functions, indexes)
tests/                 unit/, e2e/
```

---

## 7. Visual design system

- **Themes:** Editorial (light) is the default; Noir (dark) is opt-in via a header toggle, persisted in `localStorage`, applied as `data-theme="dark"` on `<html>`. All colors are CSS custom properties so both themes share one component set.
- **Typography:** Fraunces (serif — headlines, prices, logotype "Nest*Up*") + Inter (UI/body). Google Fonts via `next/font`.
- **Editorial palette:** paper `#FAF7F2`, ink `#201D1A`, accent deep green `#2F5D50`, hairlines `rgba(32,29,26,.10)`.
- **Noir palette:** surface `#191613`, text `#F5EFE6`, accent champagne `#C9A468`, hairlines `rgba(255,255,255,.10)`.
- **Language of the UI:** drawn SVG stroke icons (no emoji); one letterspaced small-caps spec line instead of chip clusters; real photography; quiet glass tag for the compatibility score on photos; large circular like/skip buttons; restrained radii and soft shadows.
- **Responsive:** mobile-first with bottom tab bar; desktop gets a top nav and centered column. Tailwind CSS with the tokens above.

---

## 8. Validation & error handling

- **Zod schemas** shared client + server for: profile (age ≥ 18, bio ≤ 500 chars, budget min ≤ max), listing (rent > 0, title/description lengths, ≤ 5 photos, valid city), filters (API route parses & clamps query params), message (1–2000 chars).
- Every server action re-validates on the server; client-side validation is UX only.
- Database constraints as the last line: CHECKs, UNIQUEs, FKs (documented in §3).
- Upload guard: image type + ≤ 5 MB, enforced in the action before touching Storage.
- **Error UX:** inline field errors on forms; toast for action failures; friendly empty states (empty deck, no matches yet, no listings found for filters); error boundaries per route group; no raw Supabase/Postgres errors surfaced to users.

## 9. Testing strategy

- **Unit (Vitest):** both compatibility scores (lifestyle in both directions; social overlap incl. empty-interests “—” case; boundary budgets, label thresholds), Zod schemas, match-creation guard logic.
- **Component (React Testing Library):** SwipeCard renders all data + fires like/skip; FilterBar builds correct query; profile & listing forms show validation errors.
- **E2E (Playwright):** ① sign up → create profile → swipe right; ② lister sees Interested queue → likes back → match appears for both; ③ chat: send + receive a message; ④ permissions: anonymous can browse listings but is redirected from /swipe; ⑤ user A cannot access user B's match/chat by URL.
- **RLS verification:** SQL-level tests (authenticated as different users via Supabase test clients) proving cross-user reads/writes fail.

## 10. Scale & security seeds (for the dedicated assignment docs)

- **Indexes:** `listings(city, rent, available_from) WHERE is_active`, `swipes(listing_id) WHERE direction='like'`, `swipes(seeker_id)`, `messages(match_id, created_at)`, `matches(seeker_id)`, `matches(lister_id)`.
- **Pagination:** Browse & API paginated (page size ~20); chat loads latest N messages with "load older"; deck fetches in small batches.
- **Known v1 limits (documented honestly):** compatibility computed in app code per request (fine at hundreds of users; would precompute/cache at scale), Realtime connection per open chat, no image CDN transforms beyond Supabase defaults, one active listing per user.
- **Security posture:** RLS everywhere, server-side validation, security-definer match creation, secrets in env vars, no service key on the client, private data (profiles, matches, chat) invisible to anonymous users. Residual risks to document: no rate limiting on auth/API, photos are public-read by URL, confirmation emails rely on Supabase's rate-limited dev mailer (custom SMTP is the production fix).

## 11. Out of scope for v1 (future work section in the docs)

Group chats for whole apartments · map view · saved searches & notifications · payments/deposits · identity verification · admin/moderation panel · i18n (Hebrew RTL) · push notifications.

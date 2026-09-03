# NestUp

**Find a room in a shared apartment — and the roommates you'll actually get along with.**

🔗 **Live:** https://nestup-kappa.vercel.app
📦 **Repository:** https://github.com/nestupweb/nestup

Final project for *Internet Technologies — Become a Full-Stack Engineer*, RUNI CS 2026.

---

## What it is

Most room-finding tools index apartments: rent, size, neighbourhood. But when you move into a shared flat, the apartment is not what you are choosing — **the people are**. Everything that decides whether it works (sleep schedules, guests, cleanliness, smoking, Shabbat) is either missing or buried in free text nobody can filter on.

NestUp matches on both. Every room carries a **Lifestyle** score and a **Social** score against your profile, and the swipe deck only shows strong matches, so a seeker visits three apartments instead of ten.

It is also built around the **household**, not the poster. Chat threads contain every roommate, listings can be co-owned, and a shared listing survives the account that created it.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3 (App Router, Server Components, Server Actions) |
| Language | TypeScript |
| Database | Supabase — Postgres 17, RLS on all 21 tables |
| Auth | Supabase Auth (email + password, mandatory confirmation) |
| Realtime | Supabase Realtime (chat, viewings) |
| Storage | Supabase Storage (listing photos, chat media) |
| Styling | Tailwind CSS v4, semantic tokens, light + dark themes |
| Maps | MapLibre GL + CARTO basemaps (keyless, self-hosted worker) |
| Validation | Zod |
| Tests | Vitest + React Testing Library + Playwright |
| Hosting | Vercel |

---

## Running locally

### Requirements

- **Node.js 22 or newer** (`node --version`)
- A **Supabase** project — free tier is enough

### 1. Install

```bash
git clone https://github.com/nestupweb/nestup.git
cd nestup
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Then fill in `.env.local` — see the table below. **Two variables are required**; everything else is optional and degrades gracefully.

### 3. Set up the database

Apply the migrations in `supabase/migrations/` (0001 → 0043, in order) to your Supabase project — via the SQL editor, the Supabase CLI, or the Supabase MCP tools. They create all tables, RLS policies, functions, triggers and indexes.

Optionally seed demo data:

```bash
npm run seed          # idempotent — safe to re-run
```

This creates demo members with listings, photos and roommates across 124 cities. Sign in as `seed.user1@nestup.dev` / `Demo1234!` (demo accounts skip email confirmation).

### 4. Run

```bash
npm run dev           # http://localhost:3000
```

---

## Environment variables

### Required

| Variable | What it is | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL. **Public** — safe in the browser. | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anonymous/publishable key. **Public by design** — it identifies the project and grants nothing on its own; every table it can reach is governed by Row Level Security. | Supabase → Project Settings → API |

### Optional

| Variable | What it enables | If unset |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `npm run seed`, and server-side reads that need to cross members (new-match notification emails). **Secret — server only, never a build argument.** | Seeding won't run; notification emails are skipped |
| `GEMINI_API_KEY` | The listing-photo check: a photo is shown to Gemini before upload and stored only if it really is the room it was tagged as. Free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). | Photos upload unchecked |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SENDER_EMAIL` / `SMTP_SENDER_NAME` | Real delivery for auth emails. Supabase's built-in mailer is dev-only (~2 mails/hour, team addresses). | Falls back to Supabase's mailer |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Calendar sync for scheduled viewings. Add `<site-url>/api/google/callback` as an authorised redirect URI. | Falls back to "Add to Google Calendar" links |
| `NEXT_PUBLIC_SITE_URL` | Public origin for OAuth redirects. | Defaults to the request origin |
| `SUPABASE_ACCESS_TOKEN` | `npm run auth:config` — pushes auth settings and email templates to Supabase. | Configure auth in the dashboard by hand |

> **Never commit real values.** `.env*.local` is gitignored. `.env.example` documents names only.
>
> **Never pass a secret as a build argument** — build args are baked into the build output. Secrets belong in runtime environment variables.

---

## Commands

```bash
npm run dev              # Development server
npm run build            # Production build
npm start                # Serve the production build
npm test                 # 97 files, 740 tests
npm run lint             # ESLint
npx tsc --noEmit         # Type check

npm run seed             # Idempotent demo data
npm run check:nav        # Real-browser check: navigation stays in one tab
npm run check:map        # Real-browser check: maps render in both themes
```

> **Always `npm test`, never `npx vitest run`.** The npm script sets `NODE_OPTIONS=--no-experimental-webstorage`; without it, Node 25 installs an inert `localStorage` global that jsdom does not replace, and the theme tests fail for reasons unrelated to the code.
>
> If interaction tests time out, re-run with `npm test -- --testTimeout=25000` before believing the failure — file-sync tools can starve `userEvent` past the 5 s default.

---

## Project structure

```
app/            Routes. (public) · (app) · (auth) route groups,
                14 Server Action modules, Route Handlers
components/     99 components by feature — auth, chat, listings,
                map, profile, settings, swipe, ui
lib/            53 domain modules — scoring, validation (Zod),
                Supabase clients, cache tags
supabase/       43 SQL migrations + auth email templates
tests/unit/     97 test files
docs/submission/  Project documentation (below)
```

---

## Documentation

| Document | Contents |
|---|---|
| [Product Specification](docs/submission/01-product-spec.md) | The problem, users, business goals, main flows, what's out of scope |
| [Technical Design](docs/submission/02-technical-design.md) | Architecture, folder structure, database, CRUD, API, business logic, state, errors, validation, UX |
| [Test Specification](docs/submission/03-test-spec.md) | What is tested and why, per category, plus known gaps |
| [Scale](docs/submission/04-scale.md) | Heavy queries, indexes, caching, measured results, limits, next steps |
| [Security](docs/submission/05-security.md) | Auth, authorisation, RLS, secrets, a disclosed trade-off, remaining risks |
| [Presentation](docs/submission/presentation.html) | 15-slide project defence. Arrow keys to move, `N` for speaker notes |

PDF versions of all five documents are in [`docs/submission/pdf/`](docs/submission/pdf/). The markdown is the source of truth — regenerate the PDFs after any edit with:

```bash
pip install markdown            # one-off, a local tool only
python scripts/docs-to-pdf.py   # markdown → print-ready HTML
node scripts/docs-to-pdf.mjs    # HTML → PDF via headless Chromium
```

---

## Notable engineering

A few decisions worth reading the code for:

- **Authorisation lives in Postgres, not the app.** 72 RLS policies across 21 tables. Three tables have *no write policy at all* — they are written only by `SECURITY DEFINER` functions, so there is no path to a wrong write rather than a policy that tries to enumerate every one.
- **Caching with a blast radius.** Every cached read carries a tag (`deck:<id>`, `chat:<id>`, …) and every mutation invalidates only what it changed. A test fails if that regresses. Returning to Swipe, Chat or Profile makes **zero server requests** and shows no loading skeleton.
- **Signing out is a 303 from a Route Handler**, not a Server Action redirect — because only a full document load empties the browser-held private caches.
- **A shared listing outlives its creator.** Deleting an account hands the room to a roommate inside the same transaction, rather than deleting a home out from under the people living in it.

---

## Licence

Coursework — not licensed for reuse.

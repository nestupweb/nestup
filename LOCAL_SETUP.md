# NestUp — Running it locally

Everything needed to take a fresh clone to a working app on `http://localhost:3000`, plus the commands used to build, lint, type-check and test it.

- **Live app:** https://nestup-kappa.vercel.app
- **Repository:** https://github.com/nestupweb/nestup

---

## 1. Requirements

| | | Check |
|---|---|---|
| **Node.js 22 or newer** | The `engines` field requires it, and the app uses Node-22-era APIs | `node --version` |
| **npm 10+** | Ships with Node 22 | `npm --version` |
| **A Supabase project** | Postgres, Auth and Storage. The free tier is enough | [supabase.com/dashboard](https://supabase.com/dashboard) |
| *(optional)* **Supabase CLI** | Only if you would rather apply migrations from the terminal than from the SQL editor | `npx supabase --version` |

Nothing else has to be installed globally. Everything below runs through `npm`.

---

## 2. Install

```bash
git clone https://github.com/nestupweb/nestup.git
cd nestup
npm install
```

There is no map account to create: the MapLibre worker and both basemap styles are committed under `public/maplibre/`, and the tiles come from CARTO's keyless endpoints. If you upgrade `maplibre-gl`, re-run `npm run maplibre:worker` so the served worker matches the installed library (`maplibre-worker.test.ts` fails if it does not).

---

## 3. Environment variables

```bash
cp .env.example .env.local        # Windows PowerShell: copy .env.example .env.local
```

`.env.example` is committed and contains **placeholders only** — no real keys. `.env.local` is gitignored (`.env*.local` in `.gitignore`) and is where your own values go.

### Required — the app will not start without these

| Variable | What it is | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL, e.g. `https://abcd1234.supabase.co`. **Public** — safe in the browser. | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anonymous/publishable key. **Public by design:** it identifies the project and grants nothing on its own — every table it can reach is governed by Row Level Security. | Supabase → Project Settings → API |

### Optional — each one degrades gracefully when unset

| Variable | What it enables | If unset |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `npm run seed`, and the server-side cross-member read behind new-match notification emails. **Secret — server only. Never a build argument, never `NEXT_PUBLIC_`.** | Seeding will not run; notification emails are skipped |
| `GEMINI_API_KEY` | The listing-photo check: each photo is shown to Gemini *before* upload and stored only if it really is the room it was tagged as. Free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Doubles as the HMAC secret for signed verdicts. | The check is off and photos upload unchecked (`isPhotoCheckEnabled()` in `lib/photo-check.ts`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_EMAIL`, `SMTP_SENDER_NAME` | Real delivery for auth emails. Supabase's built-in mailer is dev-only (~2 mails/hour, project-team addresses only). Gmail works: `smtp.gmail.com` / `587` / your address / a Google **App password**. | Falls back to Supabase's mailer |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Calendar sync for scheduled viewings. Create an OAuth 2.0 **Web** client and add `<site-url>/api/google/callback` as an authorised redirect URI. | Falls back to plain "Add to Google Calendar" links |
| `NEXT_PUBLIC_SITE_URL` | Public origin used for OAuth and email links. | Defaults to the request's own origin |
| `SUPABASE_ACCESS_TOKEN` | `npm run auth:config` — pushes Site URL, the redirect allow-list, email templates and SMTP settings to Supabase through the Management API. Personal token from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens). **Secret.** | Configure auth by hand in the dashboard |

> **Never commit real values.** `.env*.local` is gitignored; `.env.example` documents names only.
> **Never pass a secret as a build argument** — build args are baked into the output. Secrets belong in runtime environment variables.

---

## 4. Set up the database

The schema is 48 SQL migration files in `supabase/migrations/`, numbered `0001` → `0044` (four numbers appear twice, from parallel work; **filename order is the correct order**). Between them they create 21 tables (RLS enabled on every one, carrying 50 live policies, plus 7 on `storage.objects`), 36 functions, 9 triggers, 20 indexes and 3 storage buckets.

### Option A — the Supabase SQL editor (no extra tooling)

Open **SQL Editor** in the dashboard and run each file's contents **in filename order**, from `0001_init.sql` to `0044_unread_badge_counts_chats.sql`. Every migration is idempotent (`create table if not exists`, `drop policy if exists`), so re-running one is safe.

### Option B — the Supabase CLI

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### What you get

| Group | Tables |
|---|---|
| People | `profiles`, `profile_details` |
| Rooms | `listings`, `listing_residents`, `listing_invites`, `saved_listings` |
| Matching | `swipes`, `matches`, `listing_dwell`, `listing_views` |
| Chat | `conversations`, `messages`, `conversation_reads`, `conversation_deletes`, `viewings` |
| Safety | `reports`, `blocks`, `suspensions`, `app_config` |
| Plumbing | `auth_mail_throttle`, `google_tokens` |

Storage buckets `listing-photos`, `avatars` (public read) and `chat-images` (50 MB limit, `image/*` + `video/*`) are created by the migrations too.

### Auth settings

In **Authentication → Providers → Email**, make sure *Confirm email* is **on** — registration must not hand out a session. Add `http://localhost:3000/**` to **URL Configuration → Redirect URLs** so emailed links come back to your machine.

If you set `SUPABASE_ACCESS_TOKEN`, `npm run auth:config` does all of the above (Site URL, redirect list, the two HTML email templates, SMTP) in one command.

---

## 5. Seed demo data

```bash
npm run seed
```

Idempotent — safe to re-run. It creates demo members with profiles, listings, photos and roommates spread across all 124 cities, and is what makes the swipe deck non-empty on a fresh database.

Sign in as **`seed.user1@nestup.dev` / `Demo1234!`** (`seed.user2@…` and so on also exist). Demo accounts skip email confirmation.

> Requires `SUPABASE_SERVICE_ROLE_KEY`. The seed is **add-only**: `tests/unit/seed-data.test.ts` holds a sha256 fingerprint over the first 92 records, so an accidental edit to existing demo data fails the suite rather than silently changing the fixtures.

---

## 6. Run it

```bash
npm run dev            # http://localhost:3000
```

A tour of a working install:

1. `/` — the landing page.
2. `/browse` — **Listings**, public. Filters, sorting, the map dialog.
3. `/signup` → confirm by email → `/profile` onboarding.
4. Fill in the profile. **At least one preferred city** — it is the single requirement for a deck (`lib/apartment-prefs.ts`).
5. `/swipe` — the deck. Like a room, send the pre-written hello.
6. `/chat` — the thread with the household; propose a viewing.
7. `/listing` — publish a room of your own; tag roommates as co-posters.

---

## 7. Every command

```bash
# Development
npm run dev              # dev server
npm run build            # production build
npm start                # serve the production build

# Quality gates
npm test                 # 107 files, 842 tests (Vitest + React Testing Library)
npm run test:watch       # the same, in watch mode
npm run lint             # ESLint (eslint-config-next)
npx tsc --noEmit         # TypeScript, no emit

# One test file, or one name
npm test -- swipe-rank
npm test -- --testTimeout=25000            # see §8

# Data and assets
npm run seed             # idempotent demo data (needs the service-role key)
npm run auth:config      # push auth settings + email templates (needs SUPABASE_ACCESS_TOKEN)
npm run geocode:cities   # regenerate the 124 city centres
npm run addresses:real   # refresh seed addresses from a geocoder
npm run maplibre:worker  # re-copy the MapLibre worker into public/
npm run basemap:english  # rebuild the English-labelled basemap styles

# Real-browser checks (Playwright — a browser is downloaded on first run)
npm run check:nav        # no internal link opens a new tab
npm run check:map        # both themes render; red pixels counted off the WebGL canvas
npm run check:cursors    # interactive elements carry the cursor they claim
npm run check:photos     # probe the real Gemini photo check (needs GEMINI_API_KEY)
```

---

## 8. Two traps worth knowing

**1. Always `npm test`, never a bare `npx vitest run`.**
The npm script sets `NODE_OPTIONS=--no-experimental-webstorage`, and it is load-bearing. Without it, Node 25 installs its own inert `localStorage` global that jsdom does not replace, and `theme-toggle.test.tsx` fails with `localStorage.clear is not a function` — a failure that says nothing about the code.

**2. A synchronising folder starves `userEvent`.**
If the working copy lives in OneDrive, Dropbox or similar and the client is busy, roughly half a dozen interaction tests exceed Vitest's default 5-second limit. Re-run with `--testTimeout=25000` before treating a timeout as a real failure:

```bash
npm test -- --testTimeout=25000
```

---

## 9. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Your project's URL and Key are required` | `.env.local` is missing or the two `NEXT_PUBLIC_SUPABASE_*` values are blank. Restart `npm run dev` after editing it — env files are read at boot. |
| Sign-up says the code was sent but nothing arrives | Without SMTP, Supabase's built-in mailer only sends to project-team addresses, at about 2/hour. Set the `SMTP_*` variables, or confirm the user by hand in **Authentication → Users**. |
| The swipe deck is empty | Either no preferred city on your profile (the app says so in a modal), or no seeded rooms. Run `npm run seed`. |
| The deck is empty *with* a city set | The deck only admits rooms scoring 60+ combined, inside your budget and cities. Widen the budget or clear it — `0` means "any rent". |
| Listing photos upload without being checked | `GEMINI_API_KEY` is unset. That is a supported configuration: the check is skipped and the listing saves. |
| Map tiles are blank | `npm run maplibre:worker`, then hard-reload. The worker is served from `public/` and must match the installed `maplibre-gl` (asserted by `maplibre-worker.test.ts`). |
| `permission denied for table …` | A migration was skipped or run out of order. Re-run the missing file — they are idempotent. |
| Build fails on a type error after a schema change | `lib/types.ts` is hand-maintained. Update it to match the new columns. |

---

## 10. Deploying

The app is deployed on **Vercel** (project `nestup`, live at [nestup-kappa.vercel.app](https://nestup-kappa.vercel.app)) with the same Supabase project behind it.

1. Import the repository into Vercel.
2. Add the environment variables from §3 under **Settings → Environment Variables** — as *runtime* variables, not build arguments.
3. Set `NEXT_PUBLIC_SITE_URL` to the deployment origin.
4. In Supabase, add `<site-url>/**` to the auth redirect allow-list (or run `npm run auth:config`).
5. Deploy. The build command is the default `npm run build`.

---

*Companion documents: [System Guide](SYSTEM_GUIDE.md) · [Test Plan](TEST_PLAN.md) · [README](README.md)*

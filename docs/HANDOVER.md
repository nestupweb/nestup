# NestUp — Handover Brief (2026-08-25, end of day)

Paste this into a new chat to continue the project. For per-feature technical detail read `docs/superpowers/notes/handoff-notes.md` (dated bullets, newest at the bottom).

## What this is
**NestUp** — my final project for RUNI "Internet Technologies — Become a Full-Stack Engineer" (assignment PDF: `Internet Technologies (2).pdf`, **due 2026-09-06**). Two-sided shared-apartment / roommate matching: seekers browse rooms and swipe, hosts post rooms, chat is in-app (whole household in one thread), viewings are proposed and approved inside the chat. Two compatibility scores (Lifestyle + Social/shared interests). **The swipe deck shows only high matches** (combined score ≥ `MIN_DECK_SCORE` = 60 in `lib/swipe.ts`, deck cap 60); elsewhere scores only inform and sort.

## Where things live
- **Live:** https://nestup-kappa.vercel.app — the ONLY public URL. `nestup-nu18.vercel.app` and every `nestup-<hash>-nu18.vercel.app` sit behind Vercel Deployment Protection and show a Vercel login page — never share those.
- **Code:** `Final-Project/` (this folder), branch `feature/roommatch`, public GitHub repo https://github.com/nestupweb/nestup (`gh` is logged in). **A Stop hook auto-commits and pushes after every Claude turn** (`auto: <date> · N file(s)`), so never leave half-finished edits on disk at the end of a turn and never put secrets in tracked files.
- **Vercel is not git-connected.** Deploy from `Final-Project`: `VERCEL_TOKEN_STORAGE=file npx vercel deploy --prod --yes -b NEXT_PUBLIC_SUPABASE_URL=… -b NEXT_PUBLIC_SUPABASE_ANON_KEY=… -e NEXT_PUBLIC_SUPABASE_URL=… -e NEXT_PUBLIC_SUPABASE_ANON_KEY=…` (values from `.env.local`; never pass the service-role key). Always `VERCEL_TOKEN_STORAGE=file`; never run two `vercel` commands at once. If the working tree doesn't typecheck because a parallel session is mid-edit, deploy from a detached `git worktree` at the last good commit with only your files copied in (done today; works).
- **Supabase project** `eiykciushbnbwpxpvybi` (keys in `.env.local`, gitignored). RLS on every table. Migrations `supabase/migrations/0001…0021` — **all 21 are applied to the live project** (latest: `0021_lease_term` — listings carry "for how long", a rough duration shown beside the entrance date). The Supabase MCP tools (`execute_sql`, `apply_migration`) work from Claude Code; always add the matching `.sql` file too.
- **Auth:** email + password, **email confirmation ON by my explicit decision — keep it**. Demo accounts skip confirmation. Forgot-password flow: `/forgot-password` → recovery email → `/auth/confirm?token_hash=…&type=recovery` → `/reset-password` (2026-08-26). The Auth settings live in the repo: e-mail templates in `supabase/templates/`, applied with `npm run auth:config -- --apply` (`scripts/auth-config.mjs`, needs `SUPABASE_ACCESS_TOKEN`; optional `SMTP_*` for a real mail server).

## Stack
Next.js 16.3.2 App Router (Turbopack; `proxy.ts` replaces `middleware.ts`; `params`/`searchParams`/`cookies()` are async — check `node_modules/next/dist/docs/` before assuming an API). TypeScript, Tailwind v4 with a token system in `app/globals.css` (`bg-paper` `text-ink` `bg-surface` `border-hairline` `text-muted` `accent` `danger`) — never raw palette colors. Two themes: Editorial (light) and Noir (`[data-theme="dark"]`, accent turns gold). **One typeface everywhere: Inter** (Fraunces removed; `font-serif` classes gone). Type scale is one notch larger than Tailwind default via `--text-*` overrides. Supabase JS + SSR, Realtime for chat, Zod validation, Vitest + Testing Library, Playwright (library, Chromium + WebKit installed).

## Commands
- `npm run dev` → http://localhost:3000
- `npm test` — **use this, not `npx vitest`** (it sets `NODE_OPTIONS=--no-experimental-webstorage`; without it `theme-toggle.test.tsx` fails on Node 25). Currently **44 files / 231 tests passing**. `npx tsc --noEmit` and `npx eslint <paths>` are clean.
- `npm run seed` — idempotent demo data (see below). `npm run check:nav [baseUrl]` — real-browser check that internal navigation stays in one tab.
- Handy one-off Playwright probes against production live in Temp; pattern: log in as a seed user, assert, screenshot. Screenshots as proof are appreciated.

## Demo data
154 seed owners `seed.user1..154@nestup.dev` / `Demo1234!` (12 handcrafted + 80 generated + a 62-owner second wave added 2026-08-26, all deterministic in `scripts/seed-data.ts`), each with an active listing (Tel Aviv 36, every other city 9–14), a portrait and roommates. Room photos are eye-checked per tag (living room / bedroom / bathroom slots only ever show that room). The first 92 are frozen by a sha256 fingerprint in `tests/unit/seed-data.test.ts` — re-running `npm run seed` never changes them. One demo chat with a **confirmed upcoming viewing**: seed.user1 (seeker) ↔ seed.user2's Jerusalem room — shows the "Viewing scheduled" chip and the ring. Real accounts: lichtguy@gmail.com (mine), daniellevy0008@gmail.com (friend).

## What's built and live (all verified on production)
- Auth, onboarding, open-redirect-hardened `next` handling (`lib/redirect.ts sanitizeNextPath` — keep using it).
- **Profile:** header with 7rem picture (click → full-size lightbox; hover pencil → `/profile/edit`), name · profession · Instagram-style bio; tabs About me · My Listings · Liked · History. About-me private fields in `profile_details` (owner-only RLS). Read-only profile with editing on the pencil page (flag `PROFILE_EDIT_ON_PENCIL_PAGE`). Only the owner can edit (route + action + RLS; tested). Member pages `/people/[id]`.
- **Browse:** filter sidebar, cards, save-hearts, pagination, listing detail with gallery/icons/household. Listing form v2 (derived title, structured address, viewing hours editor, photos compressed in the browser and uploaded straight to storage — the ~4.5 MB Vercel body cap killed server-side uploads).
- **Swipe:** real deck, gated to ≥60, sorted by score; like → hello message into the household chat.
- **Chat (WhatsApp-style):** inbox + threads, realtime, unread badges, photos (private `chat-images` bucket), household group threads. **Sending is optimistic** (bubble in ~35 ms, cursor stays in the field, `client_id` + unique index make retries duplicate-proof, failed sends show "Not sent · Retry · Dismiss"). **Viewings:** proposed inside the chat within the host's viewing hours, approved by the other party (DB trigger enforces), optional Google Calendar mirror (env vars not set on Vercel → falls back to "Add to Google Calendar" links). Header shows **"Viewing scheduled"** (opens date/time/property/participants/notes) and the chat thumbnail gets an **accent ring** (header + inbox) while a confirmed viewing is ahead; both vanish when cancelled or past.
- Bottom floating nav (Swipe · Listings · Chat · Profile); header logo is my `Logo-NU.jpeg` rendered as a theme-coloured CSS mask (`components/ui/Logo.tsx`, `public/brand/nestup-wordmark.png`). Web-app manifest + Apple meta (`app/manifest.ts`, `display: "browser"` on purpose — no install prompt, user decision 2026-08-26), icons in `public/icons/`.
- Guards: `tests/unit/same-tab-navigation.test.ts` (no `target=_blank`/`window.open` on internal links), `npm run check:nav`.

## What remains
1. **Playwright E2E suite** as an assignment deliverable (`playwright.config.ts` + `tests/e2e/`, `@playwright/test` not installed yet — plan in `docs/superpowers/plans/…phase-3…md`). Full rigor.
2. **Assignment documents**: product spec, technical design, test spec, scale doc, security doc, 10–15 min presentation. Seed material: `docs/superpowers/specs/2026-08-24-roommatch-design.md`, plans in `docs/superpowers/plans/`, and the "For the scale doc" / "For the security doc" sections in `handoff-notes.md`. README run instructions.
3. **Ops — DONE 2026-08-26 18:05:** `npm run auth:config -- --apply` was run against the live project: Site URL `https://nestup-kappa.vercel.app`, allow-list `…/**` + `http://localhost:3000/**`, the branded templates from `supabase/templates/`, and custom SMTP = Gmail (`smtp.gmail.com:587`, sender "NestUp <lichtguy@gmail.com>", app password in `.env.local` as `SMTP_PASS`; e-mail rate limit 30/h). Auth e-mails now go to any address. Re-run the script after editing a template; `-- --show` prints the live values. `NEXT_PUBLIC_SITE_URL` is set on Vercel production. Still open: leaked-password protection; `GOOGLE_CLIENT_ID/SECRET` (redirect URI `https://nestup-kappa.vercel.app/api/google/callback`).
4. Interim landing page `app/page.tsx` still to be replaced (deferred by me).
5. App/tab icons still use the square "Nu" tile, not the new wordmark — fine unless I ask.

## How I want us to work
- **Fast mode for UI/visual work**: no review agents, batch checks at the end, show me a preview/link quickly. **Full rigor only for** auth, RLS/privacy, matching logic, E2E, deployment/migrations.
- Short iterations; explain outcome first, minimal jargon; screenshots as proof.
- **Several Claude sessions may work in this folder at once.** Before editing shared files run `ListAgents`, check `git status`, and message the peer if you'll touch its files. Don't deploy a tree that doesn't `tsc` — use the worktree trick.

## Known gotchas
- `grep -r` over the folder crawls `node_modules` on OneDrive and times out — use the Grep tool with `!{node_modules,.next}/**` or targeted paths.
- Many files have CRLF; when editing with Node scripts normalise `\r\n` first (the Edit tool is fine).
- Stale `.next/dev/types` can break `tsc` — delete `.next/dev` when no dev server runs.
- Frozen TDD test files (`filter-bar`, `listing-query`, `listing-gallery`, `interests-picker`, `redirect`) — never weaken them to make code pass.
- Mac "nav opens a new tab" report (friend) was not reproducible in Chromium or WebKit; the manifest was added for Safari "Add to Dock"/iOS home-screen scope. If it recurs, get the exact URL and whether it's a Dock app before changing code.

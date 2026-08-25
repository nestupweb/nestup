# NestUp — Handover Brief

Paste this into a new chat to continue the project. Read `docs/superpowers/notes/handoff-notes.md` next — it holds the detailed technical findings.

## What this is
**NestUp** — my final project for RUNI "Internet Technologies — Become a Full-Stack Engineer" (assignment PDF: `Internet Technologies (2).pdf`, **due 2026-09-06**). A two-sided shared-apartment / roommate matching app: seekers browse rooms and swipe, listers post rooms, mutual interest creates a match, chat is in-app. Two compatibility scores (Lifestyle + Social/shared interests) that NEVER filter anyone — both sides always decide manually.

## Stack and environment
- Next.js 16.3.2 App Router + Turbopack (NOTE: `proxy.ts` replaces `middleware.ts`; `searchParams`/`params`/`cookies()` are async; check `node_modules/next/dist/docs/` before assuming APIs).
- TypeScript, Tailwind v4 with a token design system in `app/globals.css` (bg-paper/text-ink/bg-surface/border-hairline/text-muted/accent/danger, font-serif=Fraunces, font-sans=Inter). Editorial light theme + Noir dark (`[data-theme="dark"]`). Never use raw Tailwind palette colors.
- Supabase project `eiykciushbnbwpxpvybi` (keys in `.env.local`, gitignored — never print/commit them). Postgres with **RLS on every table**, migrations in `supabase/migrations/0001–0007+`. Auth email+password with **email confirmation ON (my explicit decision — keep it)**.
- Deployed on **Vercel: https://nestup-kappa.vercel.app** (project `nestup`, team `nu18`). Redeploy from Final-Project: `VERCEL_TOKEN_STORAGE=file vercel deploy --prod --yes` with `-b`/`-e` for the two NEXT_PUBLIC Supabase vars from `.env.local`. Never pass the service-role key to Vercel.
- Tests: Vitest (49 passing, `npm test`); Playwright + Chromium installed (used for live browser probes; Task-19 E2E not written yet).
- Git branch `feature/roommatch` (no GitHub remote yet — the assignment requires one). Some working-tree changes from parallel sessions may be uncommitted; check `git status` before assuming.
- Demo data: 12 seed users `seed.user1..12@nestup.dev` / `Demo1234!` with listings, portraits, extra flatmates. `npm run seed` is idempotent.

## What's built and live
- Auth (signup → confirmation email → login), open-redirect-hardened `next` returns (`lib/redirect.ts sanitizeNextPath` — keep using it for any redirect target).
- Profile onboarding with photo/lifestyle/interests (3–10), returns to the page that triggered it via `next`.
- Browse marketplace: full-height left filter sidebar (drawer on mobile), horizontal cards, save-hearts (server-side for signed-in users), pagination, public `/api/listings`.
- Listing detail: central gallery with arrows/counter, address-as-title with building number, sectioned info with line icons (`components/listings/DetailIcon.tsx`), multiple residents under "Who lives here".
- Listing create/edit with photos (`/listing`).
- Chat: WhatsApp-style — `/chat` inbox (always opens, empty-state like new WhatsApp), threads with realtime, unread badges, viewings + optional Google Calendar (env vars not yet on Vercel). Chat entry: listing → "Message the owner". Chat RLS verified with live adversarial probes.
- Bottom floating nav (Swipe · Listings · Chat · Profile).
- Fixed: server-action body limit raised to 30mb (photo saves silently died at the default 1MB — remember this class of bug).

## What remains
1. **Swipe deck** (`/swipe` is a stub) — swipe on listings with both ScoreTags; then the matching/interested flow (MUST reuse the `conversations` table, not a parallel messages path — see handoff notes).
2. **Playwright E2E suite** (assignment deliverable; full rigor).
3. **GitHub repo + README run instructions** (deliverables).
4. **Assignment documents**: product spec, technical design, test spec, scale doc, security doc, 10–15 min presentation. Seed material: `docs/superpowers/specs/2026-08-24-roommatch-design.md`, the three plan files in `docs/superpowers/plans/`, and `docs/superpowers/notes/handoff-notes.md` (has ready-made scale/security bullet lists).
5. Small ops: set Supabase Auth Site URL to the Vercel domain (confirmation emails still point at localhost); enable leaked-password protection; optional Google OAuth env vars on Vercel.
6. My own account (lichtguy@gmail.com) may still have no saved profile — first login flow should be re-tested by me.

## How I want us to work
- **Fast mode for UI/visual work**: no review agents, commit when visually coherent, batch all checks at the end. **Full two-stage review rigor ONLY for**: auth, RLS/chat privacy, matching logic, E2E, deployment.
- Short iterations: build → show me a preview/link → I give feedback. Never run for hours without something I can see.
- I check results at http://localhost:3000 (`npm run dev`) or on the Vercel link. Screenshots as proof are appreciated.
- Explain things simply — outcome first, minimal jargon.

## Known gotchas
- Stale `.next/dev/types/validator.ts` sometimes breaks `tsc` — delete `.next/dev` when no dev server is running.
- Git CRLF warnings are normal on this machine.
- `vercel` CLI: always `VERCEL_TOKEN_STORAGE=file`; never run two vercel commands concurrently.
- The `filter-bar`, `listing-query`, `listing-gallery`, `interests-picker`, `redirect` test files are frozen TDD artifacts — never weaken them to make code pass.

# NestUp — accumulated handoff notes

Living list of non-blocking findings from task reviews. Address at the flagged task, or fold into the docs phase.

## For later code tasks

- **PRODUCT CHANGE (2026-08-24, user-approved): pre-match chat.** Chat no longer requires a mutual match — `conversations` table (migration 0004; unique listing+seeker), messages re-keyed to `conversation_id`, messages RLS now conversation-based (match-based policies dropped). Tasks 17/18 (matches flow) must REUSE conversations rather than create a parallel messages path. Still pending: owner inbox (owners currently see "This is your listing" at their own chat URL) and realtime message subscription — chat updates only via revalidation on send this round.
- **Saved rooms (browse heart button):** persisted per-browser in localStorage only (`nestup:saved-listings`, `components/listings/SaveButton.tsx`). Promote to a server-side `saved_listings` table (+ RLS, + a "Saved" view) so favorites follow the account across devices.
- **Task 16 (swipe deck):** `components/ui/ScoreTag.tsx` — "Add interests to see social match" hint is a `title` on a non-focusable span (keyboard/SR-unreachable, shadows outer title). Use `aria-label` or visually-hidden text when building the deck. Also: import `ListingWithOwner` from `@/lib/types` rather than defining inline.
- **Storage backstop:** `lib/storage.ts` trusts client `file.type`. Set `allowed_mime_types` on `avatars` / `listing-photos` buckets server-side (small migration).
- **Auth polish (from Task 9 quality review, all Minor):**
  - `lib/auth.ts` `getOwnProfile` discards the `.maybeSingle()` error — a transient DB failure reads as "no profile" and bounces an existing user into onboarding. Destructure `error` and throw it. Trailing `?? null` is redundant.
  - `components/auth/AuthForm.tsx` — React 19 clears uncontrolled inputs when an action returns an error; echo submitted email back via state and `defaultValue` so users don't retype it.
  - `app/actions/auth.ts` — credential extraction duplicated between signUp/signIn (small helper or zod schema); malformed-email branch in signIn returns inaccurate copy ("Email and password are required.").
  - `lib/auth.ts` helpers gained first consumers in Tasks 10–11 (requireUser via /swipe stub + profile action; getOwnProfile via /profile page) — behavior now exercised.
- **TabBar:** Browse/Matches/Listing links 404 until their tasks land — interim state, not a bug.
- **Cosmetic (chat action):** `app/actions/chat.ts` revalidates `/browse/${listingId}/chat` from a client-supplied (UUID-validated) listing_id; no security impact (RLS governs the insert), but could derive the path from the conversation's own listing_id for consistency.

## For the scale doc

- Unbounded page offsets in listing pagination (deep OFFSET scans).
- `messages.sender_id` FK is unindexed.
- UUIDv4 PKs (index locality tradeoff).
- Partial unique index `one_active_listing_per_owner` tradeoffs.
- Supabase dev mailer rate limits (email confirmation at scale needs custom SMTP).

## For the security doc

- `respond_to_interest` executable by any authenticated user is INTENTIONAL (RLS + function logic scope what it can do); anon execute was revoked in migration 0002.
- Supabase advisor `rls_auto_enable` warning is a false positive (event-trigger return type; not directly callable).
- Open-redirect fix history: login/onboarding `next` param sanitized via `lib/redirect.ts` `sanitizeNextPath` — blocks `//` and `/\`, and (commit 7591a6d, after the chat security review) strips ASCII tab/newline/CR first because browsers ignore those in URLs (`/\t/evil.com` would otherwise escape). Unit-tested (11 cases) — good security-doc example of iterative hardening.
- Chat RLS verified by live adversarial probes (2026-08-24 security review): 12/12 spoof/leak attempts blocked (foreign reads, spoofed seeker_id/sender_id, foreign-conversation inserts, own-listing chat, inactive-listing chat, UPDATE/DELETE absence). Pre-existing advisor note: "leaked password protection disabled" (project auth setting) — consider enabling before deploy.
- Client MIME trust in uploads (see storage backstop above).

## Product/state facts

- **Seed data:** `npm run seed` (`scripts/seed.ts`, Node-native TS + `--env-file=.env.local`) seeds 12 demo owners + active listings across all 12 cities; idempotent (skips existing seed emails `seed.user1..12@nestup.dev`); uses `SUPABASE_SERVICE_ROLE_KEY` from env — never hardcoded. Already run against the live project (2026-08-24). Demo password: Demo1234!.

- Email confirmation is ON by explicit user decision — users must click the emailed link. Confirm-signup email template in Supabase must link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
- User-approved scope focus (2026-08-24): build order Profile → Listings → Swipe; landing polish and extras deferred. Seed data allowed as support so Browse/Swipe have content.
- Interim pages to be replaced later: `app/(app)/swipe/page.tsx` stub (Task 16), `app/page.tsx` interim landing (Task 15, deferred).

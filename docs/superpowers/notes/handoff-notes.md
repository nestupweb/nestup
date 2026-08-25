# NestUp — accumulated handoff notes

Living list of non-blocking findings from task reviews. Address at the flagged task, or fold into the docs phase.

## For later code tasks

- **PRODUCT CHANGE (2026-08-24, user-approved): pre-match chat.** Chat no longer requires a mutual match — `conversations` table (migration 0004; unique listing+seeker), messages re-keyed to `conversation_id`, messages RLS now conversation-based (match-based policies dropped). Tasks 17/18 (matches flow) must REUSE conversations rather than create a parallel messages path. Still pending: owner inbox (owners currently see "This is your listing" at their own chat URL) and realtime message subscription — chat updates only via revalidation on send this round.
- **Saved rooms (browse heart button):** DONE 2026-08-25 — signed-in users persist to `saved_listings` (migration 0007, `app/actions/saved.ts`), shown under Profile › Liked. Visitors still get the localStorage list (`nestup:saved-listings`); it is NOT migrated into the account on sign-up.
- **Swipe deck (2026-08-25, replaces Task 16 stub):** `app/(app)/swipe/page.tsx` → `lib/swipe.ts` (`getSwipeDeck`: active rooms minus own/already-swiped, owners + `listing_residents`, scored with `lifestyleScore`/`socialScore`, sorted by `sortKey`, never filtered on score) → `components/swipe/{SwipeDeck,SwipeCard,SwipePanel}.tsx`. One room at a time: full-bleed photo story (segment indicators, arrows, ← → keys), Lifestyle/Social pills top-left (`role="img"` + aria-label, so the “add interests” hint is reachable), X / ♥ bottom-right, three-page panel (Essentials · The home · Flatmates) with tabs, chevrons and touch swipe. `recordSwipeAction` persists without redirect (a like also upserts `saved_listings` so Profile › Liked agrees); the card animates out via `.swipe-exit-*` in `globals.css` and the next mounts on a 360 ms timer. Listings now need ≥3 photos (`MIN_LISTING_PHOTOS`, enforced in `saveListingAction`; seed rooms backfilled to 3). `components/ui/ScoreTag.tsx` was removed (unused).
- **Storage backstop:** `lib/storage.ts` trusts client `file.type`. Set `allowed_mime_types` on `avatars` / `listing-photos` buckets server-side (small migration).
- **Auth polish (from Task 9 quality review, all Minor):**
  - `lib/auth.ts` `getOwnProfile` discards the `.maybeSingle()` error — a transient DB failure reads as "no profile" and bounces an existing user into onboarding. Destructure `error` and throw it. Trailing `?? null` is redundant.
  - `components/auth/AuthForm.tsx` — React 19 clears uncontrolled inputs when an action returns an error; echo submitted email back via state and `defaultValue` so users don't retype it.
  - `app/actions/auth.ts` — credential extraction duplicated between signUp/signIn (small helper or zod schema); malformed-email branch in signIn returns inaccurate copy ("Email and password are required.").
  - `lib/auth.ts` helpers gained first consumers in Tasks 10–11 (requireUser via /swipe stub + profile action; getOwnProfile via /profile page) — behavior now exercised.
- **Navigation (2026-08-25):** `components/ui/TabBar.tsx` replaced by the floating `components/ui/BottomNav.tsx` (Swipe · Listings · Chat · Profile) rendered by both the (app) and (public) layouts for signed-in users; the Chat item carries the unread badge from `my_unread_count()`. It hides itself on small screens inside `/chat/[id]` so the composer owns the bottom edge. `/listing` (create/edit) is reached from Profile ("+" and the dashed tile).
- **Chat (2026-08-25):** WhatsApp-style inbox at `/chat` + `/chat/[id]` (`app/(app)/chat/*`, `components/chat/*`). `/browse/[id]/chat` is now only an entry point that finds-or-creates the conversation and redirects. Inbox rows come from the SQL function `my_conversations()` (security invoker); unread = messages from the other side newer than `conversation_reads.last_read_at`, stamped by `mark_conversation_read()` (DB clock — an app-clock timestamp lost a race against a same-instant message in the live check). Realtime: `ChatRealtime` subscribes to `messages` + `viewings` and calls `router.refresh()`; chat day labels are rendered client-side only (`useMounted`) to avoid server/client timezone hydration mismatches.
- **Viewings + Google Calendar (2026-08-25):** `viewings` table (proposed/confirmed/declined/cancelled) rendered inline in the thread. `proposeViewingAction` creates a Google Calendar event with both participants as attendees when the proposer has connected Google (`google_tokens`, OAuth routes under `app/api/google/*`, helpers in `lib/google.ts`). Without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` the UI degrades to a pre-filled "Add to Google Calendar" link (`lib/calendar.ts`). The counterpart's email for the invite is resolved by `conversation_partner_email()` (security definer, participants only) — this intentionally reveals a participant's sign-in email to the other party via the invite. Not yet wired on Vercel: the two Google env vars (and `NEXT_PUBLIC_SITE_URL` for the OAuth redirect) must be added in the Vercel project settings once a Google Cloud OAuth client exists.
- **History tab:** `listing_views` is upserted from the listing detail page render for signed-in users (`app/(public)/browse/[id]/page.tsx`); capped at the 30 most recent on the profile.
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
- Interim pages to be replaced later: `app/page.tsx` interim landing (Task 15, deferred). (The `/swipe` stub was replaced by the real deck on 2026-08-25.)

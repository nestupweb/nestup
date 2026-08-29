-- 0036: our own send throttle for auth e-mail (2026-08-29).
--
-- Sign-up confirmation and password reset now go out through the app's own
-- mailer (lib/auth-mail.ts) instead of Supabase's. Measured on production:
-- the same account, the same Gmail relay, one message multipart and one
-- HTML-only — the multipart one reached the inbox and Supabase's HTML-only
-- one went to spam. Supabase's mailer offers no text part, so the only way to
-- send a text part is to send the message ourselves.
--
-- The cost of moving off it is that `smtp_max_frequency` and
-- `rate_limit_email_sent` no longer apply: those are enforced by GoTrue as it
-- sends, and it is no longer the one sending. Without a replacement the
-- sign-up form is an open relay — anyone could pump messages out of the
-- project's Gmail account until the ~500/day ceiling is gone and the account
-- is flagged. This table is that replacement.
--
-- Addresses are stored as a SHA-256 hash, never in the clear: the throttle
-- only ever needs to answer "has this exact address been mailed recently",
-- which equality on a hash does just as well, and a leaked table then reveals
-- no one's e-mail.
--
-- RLS is enabled with NO policies, deliberately. The service role bypasses RLS
-- and is the only thing that touches this table; every other role — `anon`,
-- `authenticated`, and therefore every browser — matches no policy and can
-- read and write nothing.
create table public.auth_mail_throttle (
  email_hash text primary key,
  last_sent_at timestamptz not null default now(),
  -- Kept for diagnosing a burst after the fact; nothing reads it at runtime.
  sent_count int not null default 1
);

alter table public.auth_mail_throttle enable row level security;

-- Old rows carry no value once the window has passed; this keeps the sweep in
-- 0036 cheap and the table small without a scheduled job.
create index auth_mail_throttle_stale_idx on public.auth_mail_throttle (last_sent_at);

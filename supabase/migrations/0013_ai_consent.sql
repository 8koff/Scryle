-- Consent to send photos to our AI partners (Anthropic reads them, Higgsfield stores them and makes the
-- swap). Apple guideline 5.1.2(i). Run after 0012_subscriptions.sql (or after 0011 if 0012 isn't merged yet;
-- this file doesn't depend on it). One row per account: the newest wording the person allowed.
-- The server refuses a signed-in scan unless `version` is the current one (AI_CONSENT_VERSION in
-- packages/core/src/ai-consent.ts). Closing the account deletes the row with it.

create table if not exists public.ai_consents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  version integer not null check (version > 0),
  consented_at timestamptz not null default now()
);

-- No policies: only the server reads and writes consent.
alter table public.ai_consents enable row level security;
revoke all on public.ai_consents from public, anon, authenticated, service_role;
grant select, insert, update on public.ai_consents to service_role;

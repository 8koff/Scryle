-- Revibe credits. Paste this whole file into Supabase → SQL Editor → Run.
-- One row per change to a user's credits. Balance = sum(delta). Rows are never edited
-- (except to attach a job id to a render row), so the history is the audit trail.

create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('welcome', 'purchase', 'render', 'refund', 'grant')),
  -- Purchases: the Stripe Checkout session. Unique, so a webhook retry can't add credits twice.
  stripe_session_id text unique,
  -- Renders: the Higgsfield job this credit paid for.
  job_id text,
  -- Refunds: the render row being refunded. Unique, so a render is refunded at most once.
  refund_of bigint unique references public.credit_ledger (id),
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id);
-- One render row per job, so a job is refunded at most once.
create unique index if not exists credit_ledger_one_job on public.credit_ledger (job_id) where job_id is not null;
-- One welcome credit per account, ever.
create unique index if not exists credit_ledger_one_welcome on public.credit_ledger (user_id) where reason = 'welcome';

-- People can read their own history. Nobody writes from the browser: only the server
-- (service role) calls the functions below.
alter table public.credit_ledger enable row level security;

drop policy if exists "read own credits" on public.credit_ledger;
create policy "read own credits" on public.credit_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.credit_balance(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(delta), 0)::integer from public.credit_ledger where user_id = p_user;
$$;

-- Gives the free render(s). Safe to call on every visit.
create or replace function public.grant_welcome(p_user uuid, p_credits integer)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  insert into public.credit_ledger (user_id, delta, reason)
  values (p_user, p_credits, 'welcome')
  on conflict do nothing;
  return public.credit_balance(p_user);
end;
$$;

-- Takes one credit for a render. Returns the ledger row id, or null when the balance is 0.
-- The advisory lock stops two renders at once from spending the same last credit.
create or replace function public.spend_credit(p_user uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  entry bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if public.credit_balance(p_user) < 1 then
    return null;
  end if;
  insert into public.credit_ledger (user_id, delta, reason)
  values (p_user, -1, 'render')
  returning id into entry;
  return entry;
end;
$$;

create or replace function public.attach_job(p_entry bigint, p_job text)
returns void language sql security definer set search_path = '' as $$
  update public.credit_ledger set job_id = p_job where id = p_entry and reason = 'render' and job_id is null;
$$;

-- Gives a render credit back. Safe to call twice.
create or replace function public.refund_entry(p_entry bigint)
returns void language sql security definer set search_path = '' as $$
  insert into public.credit_ledger (user_id, delta, reason, refund_of)
  select user_id, 1, 'refund', id from public.credit_ledger where id = p_entry and reason = 'render'
  on conflict do nothing;
$$;

create or replace function public.refund_job(p_job text)
returns void language sql security definer set search_path = '' as $$
  insert into public.credit_ledger (user_id, delta, reason, refund_of)
  select user_id, 1, 'refund', id from public.credit_ledger where job_id = p_job and reason = 'render'
  on conflict do nothing;
$$;

-- Adds bought credits. Safe to call twice for the same Stripe session.
-- Returns true only the first time.
create or replace function public.add_purchase(p_user uuid, p_credits integer, p_session text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.credit_ledger (user_id, delta, reason, stripe_session_id)
  values (p_user, p_credits, 'purchase', p_session)
  on conflict (stripe_session_id) do nothing;
  return found;
end;
$$;

-- Only the server may call these.
revoke all on function public.credit_balance(uuid) from public, anon, authenticated;
revoke all on function public.grant_welcome(uuid, integer) from public, anon, authenticated;
revoke all on function public.spend_credit(uuid) from public, anon, authenticated;
revoke all on function public.attach_job(bigint, text) from public, anon, authenticated;
revoke all on function public.refund_entry(bigint) from public, anon, authenticated;
revoke all on function public.refund_job(text) from public, anon, authenticated;
revoke all on function public.add_purchase(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.credit_balance(uuid) to service_role;
grant execute on function public.grant_welcome(uuid, integer) to service_role;
grant execute on function public.spend_credit(uuid) to service_role;
grant execute on function public.attach_job(bigint, text) to service_role;
grant execute on function public.refund_entry(bigint) to service_role;
grant execute on function public.refund_job(text) to service_role;
grant execute on function public.add_purchase(uuid, integer, text) to service_role;

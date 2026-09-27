-- Revibe launch safety. Run after 0002_shares.sql.
-- 1. The daily render spend cap, shared by every server (memory is per server on Vercel).
-- 2. Rate limits, shared the same way.
-- 3. Taking bought credits back when a payment is refunded or disputed.
-- 4. A list of renders to check later, so a failed render is refunded even if the buyer left.

-- 1. Spend cap -----------------------------------------------------------------------------

create table if not exists public.render_spend (
  day date primary key,
  spent_usd numeric(12, 4) not null default 0 check (spent_usd >= 0)
);

-- No policies: only the server reads and writes it.
alter table public.render_spend enable row level security;

-- Adds p_usd to today's (UTC) spend if that stays within p_cap. Returns false when it wouldn't.
-- The row lock taken by the update makes two renders at once wait for each other.
create or replace function public.reserve_spend(p_usd numeric, p_cap numeric)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if p_usd < 0 or p_cap < 0 then
    raise exception 'spend must not be negative';
  end if;
  insert into public.render_spend (day) values (today) on conflict (day) do nothing;
  update public.render_spend set spent_usd = spent_usd + p_usd
  where day = today and spent_usd + p_usd <= p_cap;
  return found;
end;
$$;

-- Gives money back to today's budget when a render couldn't start.
create or replace function public.release_spend(p_usd numeric)
returns void language sql security definer set search_path = '' as $$
  update public.render_spend set spent_usd = greatest(0, spent_usd - abs(p_usd))
  where day = (now() at time zone 'utc')::date;
$$;

-- 2. Rate limits ---------------------------------------------------------------------------

-- One row per visitor per time window. The key is a keyed hash, never a raw IP address.
create table if not exists public.rate_hits (
  key text not null check (length(key) <= 128),
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);

alter table public.rate_hits enable row level security;

-- Counts one hit. Returns 0 when allowed, or the seconds to wait when over p_limit.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_sec integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  started timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_sec) * p_window_sec);
  total integer;
begin
  insert into public.rate_hits (key, window_start) values (p_key, started)
  on conflict (key, window_start) do update set hits = public.rate_hits.hits + 1
  returning hits into total;
  if total <= p_limit then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (started + make_interval(secs => p_window_sec) - now())))::integer);
end;
$$;

-- 3. Refunds and disputes ------------------------------------------------------------------

alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('welcome', 'purchase', 'render', 'refund', 'grant', 'reversal'));
-- Reversals: the purchase row being taken back. Unique, so a purchase is reversed at most once.
alter table public.credit_ledger add column if not exists reversal_of bigint unique references public.credit_ledger (id);

-- Takes back all the credits a Stripe session added. The balance may go below 0 if they
-- were already used; then the account can't render until it buys more.
-- Returns the number of credits removed (0 if already reversed or unknown).
create or replace function public.reverse_purchase(p_session text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  removed integer;
begin
  insert into public.credit_ledger (user_id, delta, reason, reversal_of)
  select user_id, -delta, 'reversal', id from public.credit_ledger
  where stripe_session_id = p_session and reason = 'purchase'
  on conflict do nothing
  returning abs(delta) into removed; -- the new row holds the negative amount
  return coalesce(removed, 0);
end;
$$;

-- 4. Render check-ups ----------------------------------------------------------------------

-- Renders whose final result the daily check has seen, so it doesn't ask again.
create table if not exists public.render_settled (
  job_id text primary key,
  status text not null,
  settled_at timestamptz not null default now()
);

alter table public.render_settled enable row level security;

-- Paid renders from the last 3 days that are not refunded and not settled yet, oldest first.
create or replace function public.open_render_jobs(p_max integer)
returns table (job_id text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.job_id, r.created_at
  from public.credit_ledger r
  where r.reason = 'render'
    and r.job_id is not null
    and r.created_at > now() - interval '3 days'
    and not exists (select 1 from public.credit_ledger f where f.refund_of = r.id)
    and not exists (select 1 from public.render_settled s where s.job_id = r.job_id)
  order by r.created_at
  limit p_max;
$$;

create or replace function public.settle_render(p_job text, p_status text)
returns void language sql security definer set search_path = '' as $$
  insert into public.render_settled (job_id, status) values (p_job, p_status)
  on conflict (job_id) do nothing;
$$;

-- Removes rows nobody needs any more. Called by the daily check.
create or replace function public.cleanup_old_rows()
returns void language sql security definer set search_path = '' as $$
  delete from public.rate_hits where window_start < now() - interval '1 day';
  delete from public.render_spend where day < (now() at time zone 'utc')::date - 90;
  delete from public.render_settled where settled_at < now() - interval '7 days';
$$;

-- Only the server may call these.
revoke all on function public.reserve_spend(numeric, numeric) from public, anon, authenticated;
revoke all on function public.release_spend(numeric) from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.reverse_purchase(text) from public, anon, authenticated;
revoke all on function public.open_render_jobs(integer) from public, anon, authenticated;
revoke all on function public.settle_render(text, text) from public, anon, authenticated;
revoke all on function public.cleanup_old_rows() from public, anon, authenticated;
grant execute on function public.reserve_spend(numeric, numeric) to service_role;
grant execute on function public.release_spend(numeric) to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.reverse_purchase(text) to service_role;
grant execute on function public.open_render_jobs(integer) to service_role;
grant execute on function public.settle_render(text, text) to service_role;
grant execute on function public.cleanup_old_rows() to service_role;

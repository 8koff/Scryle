-- Subscriptions (docs/plans/subscriptions-revenuecat.md). Run after 0011_render_requests.sql.
-- A plan gives swaps per month; unused swaps don't roll over. Each allowance month is its own row, so a
-- new month simply starts a new row and the old one stops counting: nothing is ever deleted.
-- The server decides the plan (from RevenueCat) and the month (packages/core/src/subscriptions.ts)
-- and passes both in; these functions only keep the counting safe when two requests race.

-- The plan RevenueCat reports for each account, re-read from RevenueCat on every webhook.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  product_id text not null,
  tier text not null check (tier in ('starter', 'plus', 'pro')),
  period text not null check (period in ('monthly', 'yearly')),
  store text not null,
  -- When the current billing period began (latest purchase or renewal): allowance months count from here.
  period_start timestamptz not null,
  expires_at timestamptz not null,
  will_renew boolean not null,
  billing_issue_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz not null default now()
);

-- One row per account per allowance month.
create table if not exists public.swap_allowance (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_start timestamptz not null,
  granted integer not null check (granted >= 0),
  used integer not null default 0 check (used >= 0),
  primary key (user_id, month_start)
);

-- Which allowance month a render was paid from, so a refund goes back to that month.
alter table public.credit_ledger add column if not exists allowance_month timestamptz;

-- Server only: no browser policies. People see their plan and swaps through our API.
alter table public.subscriptions enable row level security;
alter table public.swap_allowance enable row level security;
revoke all on public.subscriptions from public, anon, authenticated;
revoke all on public.swap_allowance from public, anon, authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;
grant select on public.swap_allowance to service_role;

-- Swaps left this month. p_granted is the plan's allowance (the server passes 0 without a plan).
create or replace function public.swap_balance(p_user uuid, p_month_start timestamptz, p_granted integer)
returns integer language sql stable security definer set search_path = '' as $$
  select greatest(0, greatest(coalesce(max(a.granted), 0), p_granted) - coalesce(max(a.used), 0))
  from public.swap_allowance a
  where a.user_id = p_user and a.month_start = p_month_start;
$$;

-- Takes one swap from this month. Returns the ledger entry (for attach_job and refunds), or null
-- when the month is used up. An upgrade raises `granted` at once; it never lowers it mid-month.
create or replace function public.spend_swap(p_user uuid, p_month_start timestamptz, p_granted integer)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  entry bigint;
begin
  if p_granted < 1 then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  insert into public.swap_allowance (user_id, month_start, granted)
  values (p_user, p_month_start, p_granted)
  on conflict (user_id, month_start) do update set granted = greatest(public.swap_allowance.granted, excluded.granted);

  update public.swap_allowance set used = used + 1
  where user_id = p_user and month_start = p_month_start and used < granted;
  if not found then
    return null;
  end if;

  insert into public.credit_ledger (user_id, delta, reason, allowance_month)
  values (p_user, -1, 'render', p_month_start)
  returning id into entry;
  return entry;
end;
$$;

-- Refunds (replacing 0001's versions): the ledger row as before, and the swap back to the month it
-- came from. Still at most once per render (refund_of is unique).
create or replace function public.refund_entry(p_entry bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  render public.credit_ledger%rowtype;
begin
  select * into render from public.credit_ledger where id = p_entry and reason = 'render';
  if not found then
    return;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, refund_of)
  values (render.user_id, 1, 'refund', render.id)
  on conflict do nothing;
  if found and render.allowance_month is not null then
    update public.swap_allowance set used = greatest(0, used - 1)
    where user_id = render.user_id and month_start = render.allowance_month;
  end if;
end;
$$;

create or replace function public.refund_job(p_job text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  entry bigint;
begin
  select id into entry from public.credit_ledger where job_id = p_job and reason = 'render';
  if found then
    perform public.refund_entry(entry);
  end if;
end;
$$;

-- Only the server may call these.
revoke all on function public.swap_balance(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.spend_swap(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.refund_entry(bigint) from public, anon, authenticated;
revoke all on function public.refund_job(text) from public, anon, authenticated;
grant execute on function public.swap_balance(uuid, timestamptz, integer) to service_role;
grant execute on function public.spend_swap(uuid, timestamptz, integer) to service_role;
grant execute on function public.refund_entry(bigint) to service_role;
grant execute on function public.refund_job(text) to service_role;

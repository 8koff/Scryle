-- Revibe database setup: all migrations in one go. Safe to run more than once.

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

-- Revibe public share links (/b/<id>). Run after 0001_credits.sql.
-- A share keeps copies of the before and after photos, so the link keeps working after the
-- Higgsfield copy expires. The owner can delete it at any time.

create table if not exists public.shares (
  id text primary key check (id ~ '^[a-z0-9]{10}$'),
  owner uuid not null references auth.users (id) on delete cascade,
  -- One link per render.
  job_id text not null unique,
  pack text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  -- What was swapped in, for the "Try this on me" button: [{partId, productId} | {partId, text}].
  selections jsonb not null default '[]'::jsonb,
  -- Plain words for the page, e.g. {"Black leather bomber jacket"}. Checked by the server.
  labels text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists shares_owner_idx on public.shares (owner);

-- No policies: only the server (service role) reads and writes shares.
alter table public.shares enable row level security;

-- Public bucket for the files: <share id>/before.jpg, <share id>/after.jpg and <share id>/card.png
-- (the link preview). A file is only reachable by someone who has the link. There is no
-- storage.objects policy for this bucket, so nobody can list its contents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shares', 'shares', true, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

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

-- Revibe saved renders. Run after 0003_launch_safety.sql.
-- Every paid render is kept in the buyer's account. Higgsfield only keeps results for about
-- 7 days, so the server copies the photo and the result into our own (private) storage.

create table if not exists public.renders (
  -- The Higgsfield job. One row per paid render.
  job_id text primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  pack text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  -- What was swapped in: [{partId, productId} | {partId, text}], and plain words for the page.
  selections jsonb not null default '[]'::jsonb,
  labels text[] not null default '{}',
  -- The photo the render started from (Higgsfield storage). Copied when the render is kept.
  photo_url text not null,
  -- Set once both pictures are in the "renders" bucket as <owner>/<job_id>/{before,after}.jpg.
  kept_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists renders_owner_idx on public.renders (owner, created_at desc);

-- No policies: only the server reads and writes renders, and checks the owner itself.
alter table public.renders enable row level security;

-- Private bucket: files are only reachable through short-lived signed links the server makes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('renders', 'renders', false, 15728640, array['image/jpeg'])
on conflict (id) do nothing;

-- Revibe public gallery. Run after 0004_saved_renders.sql.
-- A share link's owner can send it to the gallery. Nothing shows on the home page until an
-- admin approves it. Deleting the link removes it from the gallery too (same row).

alter table public.shares add column if not exists gallery text not null default 'none';
alter table public.shares drop constraint if exists shares_gallery_check;
alter table public.shares add constraint shares_gallery_check
  check (gallery in ('none', 'pending', 'approved', 'rejected'));
-- When the owner sent it, or when an admin decided. Orders the queue and the gallery.
alter table public.shares add column if not exists gallery_at timestamptz;

create index if not exists shares_gallery_idx on public.shares (gallery, gallery_at desc) where gallery <> 'none';

-- Numbers for the admin page: today's render spend and the last 7 days of renders and sales.
create or replace function public.admin_stats()
returns table (spent_today_usd numeric, renders_7d bigint, purchases_7d bigint, credits_sold_7d bigint, pending_gallery bigint)
language sql stable security definer set search_path = '' as $$
  select
    coalesce((select spent_usd from public.render_spend where day = (now() at time zone 'utc')::date), 0),
    (select count(*) from public.credit_ledger where reason = 'render' and created_at > now() - interval '7 days'),
    (select count(*) from public.credit_ledger where reason = 'purchase' and created_at > now() - interval '7 days'),
    (select coalesce(sum(delta), 0) from public.credit_ledger where reason = 'purchase' and created_at > now() - interval '7 days'),
    (select count(*) from public.shares where gallery = 'pending');
$$;

revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;

-- Revibe invites. Run after 0005_gallery.sql.
-- Everyone gets one invite link. When a new account signs up through it and later buys its first
-- pack, both people get free renders. Paying first means fake accounts can't farm them.

create table if not exists public.invite_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{8}$'),
  created_at timestamptz not null default now()
);

-- Who invited whom. One row per new account; rewarded_at is set once, on the first purchase.
create table if not exists public.referrals (
  invitee uuid primary key references auth.users (id) on delete cascade,
  inviter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (invitee <> inviter)
);

create index if not exists referrals_inviter_idx on public.referrals (inviter);

-- No policies: only the server reads and writes these.
alter table public.invite_codes enable row level security;
alter table public.referrals enable row level security;

alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('welcome', 'purchase', 'render', 'refund', 'grant', 'reversal', 'invite'));

-- The user's invite code. Saves p_new the first time; after that always returns the same code.
create or replace function public.invite_code(p_user uuid, p_new text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  current_code text;
begin
  insert into public.invite_codes (user_id, code) values (p_user, p_new) on conflict (user_id) do nothing;
  select code into current_code from public.invite_codes where user_id = p_user;
  return current_code;
end;
$$;

-- Links a new account to the person who invited it. Returns 'ok', 'unknown' (no such code),
-- 'own' (your own code), 'not_new' (older than 7 days, or already rendered or bought) or 'already'.
create or replace function public.claim_invite(p_invitee uuid, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  found_inviter uuid;
begin
  select user_id into found_inviter from public.invite_codes where code = p_code;
  if found_inviter is null then
    return 'unknown';
  end if;
  if found_inviter = p_invitee then
    return 'own';
  end if;
  if (select created_at from auth.users where id = p_invitee) < now() - interval '7 days'
     or exists (select 1 from public.credit_ledger where user_id = p_invitee and reason in ('purchase', 'render')) then
    return 'not_new';
  end if;
  insert into public.referrals (invitee, inviter) values (p_invitee, found_inviter) on conflict do nothing;
  if not found then
    return 'already';
  end if;
  return 'ok';
end;
$$;

-- Called after every purchase. Pays both people once, on the invitee's first purchase.
-- The row lock taken by the update stops two purchases at once from paying twice.
create or replace function public.reward_invite(p_invitee uuid, p_credits integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  paid_inviter uuid;
begin
  update public.referrals set rewarded_at = now()
  where invitee = p_invitee and rewarded_at is null
  returning inviter into paid_inviter;
  if paid_inviter is null then
    return false;
  end if;
  insert into public.credit_ledger (user_id, delta, reason)
  values (p_invitee, p_credits, 'invite'), (paid_inviter, p_credits, 'invite');
  return true;
end;
$$;

revoke all on function public.invite_code(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_invite(uuid, text) from public, anon, authenticated;
revoke all on function public.reward_invite(uuid, integer) from public, anon, authenticated;
grant execute on function public.invite_code(uuid, text) to service_role;
grant execute on function public.claim_invite(uuid, text) to service_role;
grant execute on function public.reward_invite(uuid, integer) to service_role;

-- Revibe: reopen a saved render in the studio. Run after 0006_invites.sql.
-- Keeps the photo reader's part map with each render, so an old photo can be edited again.
-- Renders saved before this have no map and can't be reopened (the page hides the button).
alter table public.renders add column if not exists scene jsonb;

-- Revibe reports and takedowns. Run after 0007_render_scene.sql.
-- Anyone can report a share link. A report of an intimate image or a child hides the link at once
-- (the law wants such images down within 48 hours); an admin then deletes it or puts it back.

-- Set while a link is hidden: its page answers "not found" and it leaves the gallery.
alter table public.shares add column if not exists hidden_at timestamptz;

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  -- No foreign key: the report stays as a record after the link is deleted.
  share_id text not null check (share_id ~ '^[a-z0-9]{10}$'),
  reason text not null check (reason in ('intimate', 'minor', 'me', 'copyright', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  -- An email to answer, if the person gave one.
  contact text not null default '' check (char_length(contact) <= 200),
  status text not null default 'open' check (status in ('open', 'removed', 'dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists reports_open_idx on public.reports (created_at) where status = 'open';
create index if not exists reports_share_idx on public.reports (share_id);

-- No policies: only the server reads and writes reports.
alter table public.reports enable row level security;

-- Revibe store search. Run after 0008_reports.sql.
-- Products found by searching stores (SerpApi / Google Shopping) and the searches that found them.
-- A search is reused for a day, so the same search twice costs one. Products stay, so carts,
-- renders and share links that name them keep working; their price is refreshed by new searches.

create table if not exists public.shop_products (
  id text primary key check (id ~ '^live-[a-f0-9]{20}$'),
  pack text not null check (pack in ('clothing', 'car', 'room', 'anything')),
  part text not null check (char_length(part) between 1 and 60),
  title text not null check (char_length(title) between 1 and 200),
  price_cents integer not null check (price_cents > 0),
  store text not null check (char_length(store) between 1 and 80),
  image text not null check (image like 'https://%'),
  -- Google's product page: lists every store. Used when the store's own link isn't known.
  google_link text not null check (google_link like 'https://%'),
  -- Asks Google for the stores' own links; used once, the first time someone taps Buy.
  offer_token text check (char_length(offer_token) <= 4000),
  store_url text check (store_url like 'https://%'),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_searches (
  -- "<pack>:<part>:<search words>"
  key text primary key check (char_length(key) <= 250),
  product_ids text[] not null,
  created_at timestamptz not null default now()
);

create index if not exists shop_searches_created_idx on public.shop_searches (created_at);

-- No policies: only the server reads and writes these.
alter table public.shop_products enable row level security;
alter table public.shop_searches enable row level security;

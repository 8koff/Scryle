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

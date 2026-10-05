-- Durable swap-start requests. Run after 0010_waitlist.sql, before releasing the new iOS client.
-- A claimed request is never automatically reclaimed: the provider may have accepted its job.
create table if not exists public.render_requests (
  owner uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (owner, request_id),
  check ((result is null) = (finished_at is null))
);

-- No browser policies; server queries additionally filter by the verified owner.
alter table public.render_requests enable row level security;
revoke all on public.render_requests from public, anon, authenticated, service_role;
grant select, insert, update on public.render_requests to service_role;

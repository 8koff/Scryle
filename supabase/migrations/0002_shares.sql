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

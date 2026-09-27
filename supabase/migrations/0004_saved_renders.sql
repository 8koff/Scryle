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

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

-- Scryle waitlist: emails from the /waitlist page. Run after 0009_shop_search.sql.
-- One row per email. Joining twice changes nothing.

create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  -- Stored lower-case, so "A@b.com" and "a@b.com" are one person.
  email text not null unique check (char_length(email) <= 254 and email = lower(email)),
  -- Where the visitor came from (the page's ?ref=, e.g. "x"), if it said.
  source text not null default '' check (char_length(source) <= 40),
  created_at timestamptz not null default now()
);

-- No policies: only the server reads and writes the waitlist.
alter table public.waitlist enable row level security;

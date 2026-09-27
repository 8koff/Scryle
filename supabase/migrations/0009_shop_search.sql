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

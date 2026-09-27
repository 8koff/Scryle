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

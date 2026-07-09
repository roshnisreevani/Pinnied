-- Directional follow model, replacing the mutual connections system.
-- Run this once in your Supabase project's SQL Editor:
-- https://supabase.com/dashboard/project/dtrjnvbldzyqjtbuceou/sql/new
--
-- One row per direction: A→B and B→A are independent edges. "Mutual" is
-- derived (both rows exist), never stored. Follows take effect immediately —
-- there is no request/approval step, so the old /requests flow is retired.
--
-- The legacy `connections` table is kept as-is (read-only history; nothing
-- writes to it anymore) so no data is destroyed. Drop it later if you want.

-- 1. Follows ------------------------------------------------------------

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followee_id), -- no duplicate edges
  check (follower_id <> followee_id) -- no self-follows
);

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

-- Follow edges are public info within the app (needed for follower counts,
-- "follows you" state, and mutual-follow calculations on other profiles).
drop policy if exists "Follows are viewable by signed-in users" on public.follows;
create policy "Follows are viewable by signed-in users"
  on public.follows for select
  using ( auth.uid() is not null );

drop policy if exists "Users can follow others" on public.follows;
create policy "Users can follow others"
  on public.follows for insert
  with check ( auth.uid() = follower_id );

drop policy if exists "Users can unfollow" on public.follows;
create policy "Users can unfollow"
  on public.follows for delete
  using ( auth.uid() = follower_id );

-- 2. Migrate existing connections ----------------------------------------
-- Accepted connection A↔B  → two edges (A→B and B→A).
-- Pending request R→X      → one edge (R→X): the requester's intent becomes
-- an immediate follow; the recipient simply isn't following back. Nothing
-- is auto-accepted because approval no longer exists as a concept.

-- Forward edge (requester → recipient), for both pending and accepted rows:
insert into public.follows (follower_id, followee_id, created_at)
select
  c.requested_by,
  case when c.requested_by = c.user_a then c.user_b else c.user_a end,
  c.created_at
from public.connections c
on conflict (follower_id, followee_id) do nothing;

-- Reverse edge (recipient → requester), only where the request was accepted:
insert into public.follows (follower_id, followee_id, created_at)
select
  case when c.requested_by = c.user_a then c.user_b else c.user_a end,
  c.requested_by,
  coalesce(c.responded_at, c.created_at)
from public.connections c
where c.status = 'accepted'
on conflict (follower_id, followee_id) do nothing;

-- 3. Banter DM permission now keys off follows ----------------------------
-- Was: accepted connection OR shared group. Now: a follow edge in either
-- direction OR shared group. (Blocks still refuse the DM outright.)

create or replace function public.get_or_create_dm(p_other_user_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_key text;
  v_id uuid;
begin
  if v_me is null or p_other_user_id is null or p_other_user_id = v_me then
    raise exception 'Invalid user.';
  end if;

  if exists (
    select 1 from public.blocked_users
    where (blocker_id = v_me and blocked_id = p_other_user_id)
       or (blocker_id = p_other_user_id and blocked_id = v_me)
  ) then
    raise exception 'You can''t message this user.';
  end if;

  if not exists (
    select 1 from public.follows
    where (follower_id = v_me and followee_id = p_other_user_id)
       or (follower_id = p_other_user_id and followee_id = v_me)
  ) and not exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = v_me and theirs.user_id = p_other_user_id
  ) then
    raise exception 'You can only message people you follow, who follow you, or who share a group with you.';
  end if;

  v_key := least(v_me::text, p_other_user_id::text) || ':' || greatest(v_me::text, p_other_user_id::text);

  select id into v_id from public.conversations where dm_key = v_key;
  if v_id is null then
    insert into public.conversations (conv_type, dm_key)
    values ('dm', v_key)
    on conflict (dm_key) do nothing;
    select id into v_id from public.conversations where dm_key = v_key;

    insert into public.conversation_members (conversation_id, user_id)
    values (v_id, v_me), (v_id, p_other_user_id)
    on conflict (conversation_id, user_id) do nothing;
  end if;

  return v_id;
end;
$$;

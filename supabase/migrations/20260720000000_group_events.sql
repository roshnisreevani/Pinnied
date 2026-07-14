-- Game-day events: per-group event cards with RSVPs and post-game MVP votes.
-- Run this once in your Supabase project's SQL Editor:
-- https://supabase.com/dashboard/project/dtrjnvbldzyqjtbuceou/sql/new
--
-- RLS approach (matches group posts/leaderboard):
--  * group_events gated on the is_group_member/is_group_owner helpers.
--  * rsvps/votes delegate visibility to group_events via invoker-rights
--    subqueries (same pattern as post_comments inheriting posts).
--  * MVP-vote timing is enforced HERE, at the database: a vote insert/update
--    is refused while event_date is still in the future, no matter what the
--    client sends. Policies evaluate now() per statement.

-- 1. Events -----------------------------------------------------------------

create table if not exists public.group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  sport text,
  event_date timestamptz not null,
  location text not null default '',
  max_spots int check (max_spots is null or max_spots > 0), -- null = unlimited
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists group_events_group_date_idx on public.group_events (group_id, event_date desc);

alter table public.group_events enable row level security;

drop policy if exists "Members can view group events" on public.group_events;
create policy "Members can view group events"
  on public.group_events for select
  using ( public.is_group_member(group_id, auth.uid()) );

drop policy if exists "Owner can create events" on public.group_events;
create policy "Owner can create events"
  on public.group_events for insert
  with check ( auth.uid() = created_by and public.is_group_owner(group_id, auth.uid()) );

drop policy if exists "Owner can update events" on public.group_events;
create policy "Owner can update events"
  on public.group_events for update
  using ( public.is_group_owner(group_id, auth.uid()) );

drop policy if exists "Owner can delete events" on public.group_events;
create policy "Owner can delete events"
  on public.group_events for delete
  using ( public.is_group_owner(group_id, auth.uid()) );

-- 2. RSVPs ---------------------------------------------------------------------

create table if not exists public.group_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.group_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('attending', 'declined')),
  responded_at timestamptz not null default now(),
  unique (event_id, user_id) -- one row per user per event; changing = upsert
);

create index if not exists group_event_rsvps_event_idx on public.group_event_rsvps (event_id);

alter table public.group_event_rsvps enable row level security;

-- Capacity guard: can this user take (or keep) an 'attending' spot? Their own
-- existing row is excluded from the count so changing an existing RSVP always
-- works; only NEW attendees are blocked once max_spots is reached.
create or replace function public.event_has_spot(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select e.max_spots is null
    or (
      select count(*) from public.group_event_rsvps r
      where r.event_id = p_event_id and r.status = 'attending' and r.user_id <> p_user_id
    ) < e.max_spots
  from public.group_events e
  where e.id = p_event_id;
$$;

drop policy if exists "RSVPs visible with their event" on public.group_event_rsvps;
create policy "RSVPs visible with their event"
  on public.group_event_rsvps for select
  using ( exists (select 1 from public.group_events e where e.id = event_id) );

drop policy if exists "Members can RSVP" on public.group_event_rsvps;
create policy "Members can RSVP"
  on public.group_event_rsvps for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.group_events e where e.id = event_id)
    and (status <> 'attending' or public.event_has_spot(event_id, auth.uid()))
  );

drop policy if exists "Users can change their own RSVP" on public.group_event_rsvps;
create policy "Users can change their own RSVP"
  on public.group_event_rsvps for update
  using ( auth.uid() = user_id )
  with check (
    auth.uid() = user_id
    and (status <> 'attending' or public.event_has_spot(event_id, auth.uid()))
  );

drop policy if exists "Users can remove their own RSVP" on public.group_event_rsvps;
create policy "Users can remove their own RSVP"
  on public.group_event_rsvps for delete
  using ( auth.uid() = user_id );

-- 3. MVP votes -------------------------------------------------------------------

create table if not exists public.group_event_mvp_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.group_events(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  voted_for_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, voter_id), -- one vote per member; changing = upsert
  check (voter_id <> voted_for_id) -- no voting for yourself
);

create index if not exists group_event_mvp_votes_event_idx on public.group_event_mvp_votes (event_id);

alter table public.group_event_mvp_votes enable row level security;

drop policy if exists "Votes visible with their event" on public.group_event_mvp_votes;
create policy "Votes visible with their event"
  on public.group_event_mvp_votes for select
  using ( exists (select 1 from public.group_events e where e.id = event_id) );

-- Voting opens only once the event has started/passed (event_date <= now()),
-- and only attendees can receive votes. Both enforced here, not just in UI.
drop policy if exists "Members can vote MVP after the event" on public.group_event_mvp_votes;
create policy "Members can vote MVP after the event"
  on public.group_event_mvp_votes for insert
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.group_events e
      where e.id = event_id and e.event_date <= now()
    )
    and exists (
      select 1 from public.group_event_rsvps r
      where r.event_id = group_event_mvp_votes.event_id
        and r.user_id = voted_for_id
        and r.status = 'attending'
    )
  );

drop policy if exists "Voters can change their vote" on public.group_event_mvp_votes;
create policy "Voters can change their vote"
  on public.group_event_mvp_votes for update
  using ( auth.uid() = voter_id )
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.group_events e
      where e.id = event_id and e.event_date <= now()
    )
    and exists (
      select 1 from public.group_event_rsvps r
      where r.event_id = group_event_mvp_votes.event_id
        and r.user_id = voted_for_id
        and r.status = 'attending'
    )
  );

drop policy if exists "Voters can remove their vote" on public.group_event_mvp_votes;
create policy "Voters can remove their vote"
  on public.group_event_mvp_votes for delete
  using ( auth.uid() = voter_id );

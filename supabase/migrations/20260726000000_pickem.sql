-- Pick'Em: member-vs-member matchups other group members vote on, with a
-- reused comment thread. Run once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/dtrjnvbldzyqjtbuceou/sql/new
--
-- RLS mirrors the corrected group-feature pattern: is_group_member/
-- is_group_owner with group_id FIRST (the reversed-arg bug that broke
-- brackets). ANY group member can create a Pick'Em and vote — no owner-only
-- gate. Participants in a matchup cannot vote on their own matchup.

-- 1. Matchups ----------------------------------------------------------------

create table if not exists public.pick_ems (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists pick_ems_group_idx on public.pick_ems (group_id, created_at desc);

alter table public.pick_ems enable row level security;

drop policy if exists "Members can view pick'ems" on public.pick_ems;
create policy "Members can view pick'ems"
  on public.pick_ems for select
  using ( public.is_group_member(group_id, auth.uid()) );

drop policy if exists "Members can create pick'ems" on public.pick_ems;
create policy "Members can create pick'ems"
  on public.pick_ems for insert
  with check ( auth.uid() = created_by and public.is_group_member(group_id, auth.uid()) );

drop policy if exists "Creator or owner can delete pick'ems" on public.pick_ems;
create policy "Creator or owner can delete pick'ems"
  on public.pick_ems for delete
  using ( auth.uid() = created_by or public.is_group_owner(group_id, auth.uid()) );

-- 2. Participants (which members are on side A / side B) ----------------------

create table if not exists public.pick_em_participants (
  id uuid primary key default gen_random_uuid(),
  pick_em_id uuid not null references public.pick_ems(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  unique (pick_em_id, user_id) -- a member can only be on one side
);

create index if not exists pick_em_participants_idx on public.pick_em_participants (pick_em_id);

alter table public.pick_em_participants enable row level security;

drop policy if exists "Participants visible with their pick'em" on public.pick_em_participants;
create policy "Participants visible with their pick'em"
  on public.pick_em_participants for select
  using (
    exists (
      select 1 from public.pick_ems pe
      where pe.id = pick_em_id and public.is_group_member(pe.group_id, auth.uid())
    )
  );

-- Only the pick'em's creator seeds participants (done at creation time).
drop policy if exists "Creator sets participants" on public.pick_em_participants;
create policy "Creator sets participants"
  on public.pick_em_participants for insert
  with check (
    exists (select 1 from public.pick_ems pe where pe.id = pick_em_id and pe.created_by = auth.uid())
  );

-- Is this user in the matchup? Security definer so the vote policy can call
-- it without RLS recursion. Used to block participants voting on their own.
create or replace function public.is_pickem_participant(p_pick_em_id uuid, p_user_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.pick_em_participants
    where pick_em_id = p_pick_em_id and user_id = p_user_id
  );
$$;

-- 3. Votes -------------------------------------------------------------------

create table if not exists public.pick_em_votes (
  id uuid primary key default gen_random_uuid(),
  pick_em_id uuid not null references public.pick_ems(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  created_at timestamptz not null default now(),
  unique (pick_em_id, voter_id) -- one vote per member; changing = upsert
);

create index if not exists pick_em_votes_idx on public.pick_em_votes (pick_em_id);

alter table public.pick_em_votes enable row level security;

drop policy if exists "Votes visible with their pick'em" on public.pick_em_votes;
create policy "Votes visible with their pick'em"
  on public.pick_em_votes for select
  using (
    exists (
      select 1 from public.pick_ems pe
      where pe.id = pick_em_id and public.is_group_member(pe.group_id, auth.uid())
    )
  );

-- Any group member may vote, EXCEPT the matchup's own participants.
drop policy if exists "Members can vote" on public.pick_em_votes;
create policy "Members can vote"
  on public.pick_em_votes for insert
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.pick_ems pe
      where pe.id = pick_em_id and public.is_group_member(pe.group_id, auth.uid())
    )
    and not public.is_pickem_participant(pick_em_id, auth.uid())
  );

drop policy if exists "Voters can change their vote" on public.pick_em_votes;
create policy "Voters can change their vote"
  on public.pick_em_votes for update
  using ( auth.uid() = voter_id )
  with check (
    auth.uid() = voter_id
    and not public.is_pickem_participant(pick_em_id, auth.uid())
  );

drop policy if exists "Voters can remove their vote" on public.pick_em_votes;
create policy "Voters can remove their vote"
  on public.pick_em_votes for delete
  using ( auth.uid() = voter_id );

-- 4. Comments (same shape/behavior as post_comments, isolated table) ---------

create table if not exists public.pick_em_comments (
  id uuid primary key default gen_random_uuid(),
  pick_em_id uuid not null references public.pick_ems(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  parent_comment_id uuid references public.pick_em_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists pick_em_comments_idx on public.pick_em_comments (pick_em_id, created_at);
create index if not exists pick_em_comments_parent_idx on public.pick_em_comments (parent_comment_id);

alter table public.pick_em_comments enable row level security;

drop policy if exists "Comments visible with their pick'em" on public.pick_em_comments;
create policy "Comments visible with their pick'em"
  on public.pick_em_comments for select
  using (
    exists (
      select 1 from public.pick_ems pe
      where pe.id = pick_em_id and public.is_group_member(pe.group_id, auth.uid())
    )
  );

drop policy if exists "Members can comment" on public.pick_em_comments;
create policy "Members can comment"
  on public.pick_em_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pick_ems pe
      where pe.id = pick_em_id and public.is_group_member(pe.group_id, auth.uid())
    )
  );

-- Author, the pick'em creator, or the group owner can delete a comment.
drop policy if exists "Author creator or owner can delete comment" on public.pick_em_comments;
create policy "Author creator or owner can delete comment"
  on public.pick_em_comments for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.pick_ems pe
      where pe.id = pick_em_id
        and (pe.created_by = auth.uid() or public.is_group_owner(pe.group_id, auth.uid()))
    )
  );

-- 5. Comment likes (parallel to comment_likes for post_comments) -------------

create table if not exists public.pick_em_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.pick_em_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

alter table public.pick_em_comment_likes enable row level security;

drop policy if exists "Likes visible with their comment" on public.pick_em_comment_likes;
create policy "Likes visible with their comment"
  on public.pick_em_comment_likes for select
  using (
    exists (
      select 1 from public.pick_em_comments c
      join public.pick_ems pe on pe.id = c.pick_em_id
      where c.id = comment_id and public.is_group_member(pe.group_id, auth.uid())
    )
  );

drop policy if exists "Members can like comments" on public.pick_em_comment_likes;
create policy "Members can like comments"
  on public.pick_em_comment_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pick_em_comments c
      join public.pick_ems pe on pe.id = c.pick_em_id
      where c.id = comment_id and public.is_group_member(pe.group_id, auth.uid())
    )
  );

drop policy if exists "Users can unlike" on public.pick_em_comment_likes;
create policy "Users can unlike"
  on public.pick_em_comment_likes for delete
  using ( auth.uid() = user_id );

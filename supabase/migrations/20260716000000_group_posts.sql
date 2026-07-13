-- Group-scoped posts: posts.group_id now points at REAL groups (uuid string)
-- and group posts are visible only to that group's members, enforced by RLS.
-- Run this once in your Supabase project's SQL Editor:
-- https://supabase.com/dashboard/project/dtrjnvbldzyqjtbuceou/sql/new
--
-- posts.group_id stays text with no FK (as the feed schema chose) — the
-- policies below cast it to uuid for the membership check. Posts of a
-- deleted group become invisible to everyone (no cascade), which is fine.

-- 1. group_id must be nullable (null = global feed post). The original feed
-- schema declared it NOT NULL; the app already inserts null, so this may
-- have been changed directly in the dashboard — this makes it official.
alter table public.posts alter column group_id drop not null;

-- 2. Legacy mock group ids (pre-real-Groups slugs, not uuids) become plain
-- global posts — same visibility they effectively had, now with clean
-- semantics: null = everyone, uuid = that group's members only.
update public.posts set group_id = null
where group_id is not null
  and group_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 3. Visibility: global posts stay public; group posts are members-only.
-- Reuses the security-definer is_group_member() from the groups schema
-- (which exists precisely to avoid RLS recursion).
drop policy if exists "Posts are viewable by everyone" on public.posts;
drop policy if exists "Global posts public, group posts members-only" on public.posts;
create policy "Global posts public, group posts members-only"
  on public.posts for select
  using (
    group_id is null
    or public.is_group_member(group_id::uuid, auth.uid())
  );

-- 4. Creating: you can only post into a group you belong to.
drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts for insert
  with check (
    auth.uid() = author_id
    and (group_id is null or public.is_group_member(group_id::uuid, auth.uid()))
  );

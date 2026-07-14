-- Captures RLS changes made manually in the SQL Editor on group_events, so
-- migration history matches production:
--   1. INSERT: any group member can create an event (not just the owner).
--      (Also captured in 20260721000000_member_created_events.sql — repeated
--      here idempotently in case the manual policy used a different name.)
--   2. UPDATE/DELETE: the event's creator OR the group owner (was owner-only).
--
-- Safe to run on production: it drops every known prior name for each
-- policy and recreates the canonical one, so re-running just normalizes
-- names without changing behavior.

-- 1. INSERT: any member ------------------------------------------------------

drop policy if exists "Owner can create events" on public.group_events;
drop policy if exists "Members can create events" on public.group_events;
create policy "Members can create events"
  on public.group_events for insert
  with check (
    auth.uid() = created_by
    and public.is_group_member(group_id, auth.uid())
  );

-- 2. UPDATE/DELETE: creator or group owner -----------------------------------

drop policy if exists "Owner can update events" on public.group_events;
drop policy if exists "Creator or owner can update events" on public.group_events;
create policy "Creator or owner can update events"
  on public.group_events for update
  using (
    auth.uid() = created_by
    or public.is_group_owner(group_id, auth.uid())
  );

drop policy if exists "Owner can delete events" on public.group_events;
drop policy if exists "Creator or owner can delete events" on public.group_events;
create policy "Creator or owner can delete events"
  on public.group_events for delete
  using (
    auth.uid() = created_by
    or public.is_group_owner(group_id, auth.uid())
  );

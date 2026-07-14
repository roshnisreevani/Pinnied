-- Game-day events: any group member can create one (was owner-only).
-- Run this once in your Supabase project's SQL Editor:
-- https://supabase.com/dashboard/project/dtrjnvbldzyqjtbuceou/sql/new
--
-- Editing/deleting an event stays owner-only (unchanged policies).

drop policy if exists "Owner can create events" on public.group_events;
drop policy if exists "Members can create events" on public.group_events;
create policy "Members can create events"
  on public.group_events for insert
  with check (
    auth.uid() = created_by
    and public.is_group_member(group_id, auth.uid())
  );

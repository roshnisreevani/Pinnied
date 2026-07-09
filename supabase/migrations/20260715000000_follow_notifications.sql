-- Follow notifications: extend the existing notifications table (see
-- 20260713000000_notifications.sql) with a 'follow' type, populated by a
-- trigger on follows — same architecture as reaction/comment notifications
-- (security-definer trigger inserts; clients never insert directly).
-- Run this once in your Supabase project's SQL Editor:
-- https://supabase.com/dashboard/project/dtrjnvbldzyqjtbuceou/sql/new

-- 1. Allow the new type ----------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reaction', 'comment', 'follow'));

-- 2. No self-notifications (defense in depth — triggers already guard this)

alter table public.notifications drop constraint if exists notifications_no_self_check;
alter table public.notifications add constraint notifications_no_self_check
  check (actor_id is null or recipient_id <> actor_id);

-- 3. Dedupe: at most ONE 'follow' notification per (recipient, actor), ever.
-- Rapid follow/unfollow/refollow can't spam; the trigger's ON CONFLICT
-- silently skips repeats. (Deliberate tradeoff: a genuine re-follow later
-- doesn't re-notify.) Partial index, so reaction/comment rows are untouched.

create unique index if not exists notifications_follow_dedupe_idx
  on public.notifications (recipient_id, actor_id)
  where type = 'follow';

-- 4. Trigger: notify on new follow ------------------------------------------
-- The exception guard means a failed notification insert can never block or
-- roll back the follow itself.

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.notifications (recipient_id, type, actor_id)
    values (new.followee_id, 'follow', new.follower_id)
    on conflict (recipient_id, actor_id) where type = 'follow' do nothing;
  exception when others then
    null; -- notification is best-effort; the follow must always succeed
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_follow on public.follows;
create trigger trg_notify_on_follow
after insert on public.follows
for each row execute function public.notify_on_follow();

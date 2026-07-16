-- Instagram-style comment likes, plus the comment_reply notification that
-- was missing from 20260718000000_comment_replies.sql (that migration only
-- added the parent_comment_id column — it never wired up a notification for
-- the parent comment's author).

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists comment_likes_comment_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

create policy "Comment likes are viewable by everyone" on public.comment_likes
  for select using (true);

create policy "Users can like comments" on public.comment_likes
  for insert with check (auth.uid() = user_id);

create policy "Users can unlike comments" on public.comment_likes
  for delete using (auth.uid() = user_id);

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reaction', 'comment', 'follow', 'comment_like', 'comment_reply'));

create or replace function public.notify_on_comment_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment_author uuid;
  v_post_id uuid;
begin
  select user_id, post_id into v_comment_author, v_post_id
    from public.post_comments where id = new.comment_id;
  if v_comment_author is not null and v_comment_author <> new.user_id then
    insert into public.notifications (recipient_id, type, actor_id, related_content_id)
    values (v_comment_author, 'comment_like', new.user_id, v_post_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment_like on public.comment_likes;
create trigger trg_notify_on_comment_like
after insert on public.comment_likes
for each row execute function public.notify_on_comment_like();

-- Notifies a top-level comment's author when someone replies to them.
-- Skipped when the parent author is also the post author, since
-- notify_on_comment already sends them a plain 'comment' notification for
-- every comment (including replies) on their post.
create or replace function public.notify_on_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_author uuid;
  v_post_author uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;
  select user_id into v_parent_author
    from public.post_comments where id = new.parent_comment_id;
  select author_id into v_post_author
    from public.posts where id = new.post_id;
  if v_parent_author is not null
     and v_parent_author <> new.user_id
     and (v_post_author is null or v_parent_author <> v_post_author) then
    insert into public.notifications (recipient_id, type, actor_id, related_content_id)
    values (v_parent_author, 'comment_reply', new.user_id, new.post_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment_reply on public.post_comments;
create trigger trg_notify_on_comment_reply
after insert on public.post_comments
for each row execute function public.notify_on_comment_reply();

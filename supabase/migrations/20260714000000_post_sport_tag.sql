-- Adds an optional sport tag to posts, so the feed can show what sport a
-- post was for instead of (or alongside) the group. Nullable since existing
-- posts won't have one, and it's optional going forward too.
alter table public.posts
  add column if not exists sport_tag text;

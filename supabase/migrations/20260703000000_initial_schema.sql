-- The Rec — Profile tab schema
-- Applied to the linked project via `supabase db push`.
-- (A copy of this also lives at supabase/schema.sql for manual pasting into
-- the SQL Editor, if you'd rather do it that way instead of the CLI.)

-- 1. Profiles table -----------------------------------------------------

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  location text not null default '',
  sport_tags text[] not null default '{}',
  legend text not null default '',
  walkup_song_title text,
  walkup_song_artist text,
  walkup_song_artwork_url text,
  walkup_song_preview_url text,
  pick_three jsonb not null default '[]'::jsonb,
  avatar_url text,
  trophies jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Safe to re-run: adds the new columns if you already ran an earlier version
-- of this script before the profile photo / freeform trophy case features existed.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists trophies jsonb not null default '[]'::jsonb;

-- Settings screen preferences. The notification toggles are UI-only for now
-- since there's no push notification pipeline yet — they just round-trip so
-- the Settings screen has something real to read/write, ready to wire up to
-- actual push delivery later. Same for the location privacy toggle: there's
-- no precise-location/geolocation feature yet (location is just a free-text
-- city field), so this is a stored preference the future feature can read.
alter table public.profiles add column if not exists notify_group_activity boolean not null default true;
alter table public.profiles add column if not exists notify_banter_replies boolean not null default true;
alter table public.profiles add column if not exists location_privacy_approximate boolean not null default false;

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using ( auth.uid() = id );

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles for delete
  using ( auth.uid() = id );

-- Optional but recommended: auto-create a blank profile row the moment
-- someone signs up, so the app never has to guess whether a row exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, '')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Storage bucket for "Pick Your 3" photos -----------------------------

insert into storage.buckets (id, name, public)
values ('pick-three', 'pick-three', true)
on conflict (id) do nothing;

drop policy if exists "Pick Three photos are publicly readable" on storage.objects;
create policy "Pick Three photos are publicly readable"
  on storage.objects for select
  using ( bucket_id = 'pick-three' );

drop policy if exists "Users can upload their own Pick Three photos" on storage.objects;
create policy "Users can upload their own Pick Three photos"
  on storage.objects for insert
  with check (
    bucket_id = 'pick-three'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own Pick Three photos" on storage.objects;
create policy "Users can update their own Pick Three photos"
  on storage.objects for update
  using (
    bucket_id = 'pick-three'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own Pick Three photos" on storage.objects;
create policy "Users can delete their own Pick Three photos"
  on storage.objects for delete
  using (
    bucket_id = 'pick-three'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Notes:
-- * Photos are uploaded to paths like "<user id>/<timestamp>-<n>.jpg", which is
--   what makes the "own folder" policies above work.
-- * The bucket is public-read so profile photos can be displayed with a plain
--   URL. Only the owner (matched by auth.uid()) can write/update/delete inside
--   their own folder.

-- 3. Storage bucket for profile photos (the avatar circle) ----------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Account deletion --------------------------------------------------
-- Deleting a user's storage files and their auth.users record both require
-- the service role key, which must never ship inside the app — so the whole
-- delete flow (storage cleanup, then the auth user, which cascades to the
-- profiles row via ON DELETE CASCADE) runs inside the "delete-account" Edge
-- Function instead. See supabase/functions/delete-account/README.md for how
-- to deploy it. The "own row" delete policy above is kept as a safety net
-- (harmless, and lets you clean up a profile row manually from the SQL
-- editor if you ever need to), but the app itself no longer relies on it.

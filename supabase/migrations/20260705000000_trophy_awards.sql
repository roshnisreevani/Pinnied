-- The Rec — Trophy awarding (self-nominated vs. friend-awarded trophies)
--
-- Trophies themselves stay stored as jsonb on public.profiles (no schema
-- change needed there — the Trophy object shape just grows two optional
-- client-side fields: awarded_by / awarded_by_name). What DOES need a real
-- table is the "send someone a pending trophy" step: a user needs to write a
-- row that another user will read and act on, which a jsonb column on
-- someone else's profile row can't support under RLS (you can only update
-- your own profile row). So a pending award lives here until the recipient
-- accepts (at which point the client copies it into their own profile's
-- trophies jsonb array) or declines (row just gets marked declined).

create table if not exists public.trophy_awards (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users on delete cascade,
  to_user_id uuid not null references auth.users on delete cascade,
  icon text not null,
  title text not null,
  subtitle text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists trophy_awards_to_user_idx on public.trophy_awards (to_user_id, status);

alter table public.trophy_awards enable row level security;

drop policy if exists "Awards are viewable by sender or recipient" on public.trophy_awards;
create policy "Awards are viewable by sender or recipient"
  on public.trophy_awards for select
  using ( auth.uid() = from_user_id or auth.uid() = to_user_id );

drop policy if exists "Users can send awards" on public.trophy_awards;
create policy "Users can send awards"
  on public.trophy_awards for insert
  with check ( auth.uid() = from_user_id and from_user_id <> to_user_id );

drop policy if exists "Recipient can respond to their pending awards" on public.trophy_awards;
create policy "Recipient can respond to their pending awards"
  on public.trophy_awards for update
  using ( auth.uid() = to_user_id )
  with check ( auth.uid() = to_user_id );

drop policy if exists "Sender can withdraw an award they sent" on public.trophy_awards;
create policy "Sender can withdraw an award they sent"
  on public.trophy_awards for delete
  using ( auth.uid() = from_user_id );

-- Note: the existing "Profiles are viewable by everyone" policy on
-- public.profiles (see schema.sql) already lets the award-sender search other
-- users by name and lets the recipient's name/avatar be shown on the pending
-- award card — no additional profiles policy needed.

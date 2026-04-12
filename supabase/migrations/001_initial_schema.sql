-- Board Game Engine: profiles, friendships, lobbies
-- Run in Supabase SQL Editor or: supabase db push

-- Extensions
create extension if not exists "pgcrypto";

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := coalesce(
    new.raw_user_meta_data->>'preferred_username',
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1)
  );
  if base_username is null or length(trim(base_username)) = 0 then
    base_username := 'player';
  end if;
  -- Unique per user (avoids collisions on common email local-parts)
  final_username := left(regexp_replace(trim(base_username), '[^a-zA-Z0-9_]', '_', 'g'), 24) || '_' || substr(replace(new.id::text, '-', ''), 1, 12);

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'user_name',
      base_username
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Friendships
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index friendships_requester_idx on public.friendships(requester_id);
create index friendships_addressee_idx on public.friendships(addressee_id);

alter table public.friendships enable row level security;

create policy "Friendships visible to participants"
  on public.friendships for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = requester_id);

create policy "Addressee can update friendship status"
  on public.friendships for update
  to authenticated
  using (auth.uid() = addressee_id or auth.uid() = requester_id)
  with check (auth.uid() = addressee_id or auth.uid() = requester_id);

create policy "Participants can delete friendship row"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Lobbies
create table public.lobbies (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  game_key text not null default 'bsg_1',
  name text not null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  max_players int not null default 6 check (max_players >= 2 and max_players <= 20),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create index lobbies_status_idx on public.lobbies(status);
create index lobbies_invite_code_idx on public.lobbies(invite_code);

alter table public.lobbies enable row level security;

create policy "Authenticated can read lobbies"
  on public.lobbies for select
  to authenticated
  using (true);

create policy "Authenticated can create lobby"
  on public.lobbies for insert
  to authenticated
  with check (auth.uid() = host_id);

create policy "Host can update lobby"
  on public.lobbies for update
  to authenticated
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

create policy "Host can delete lobby"
  on public.lobbies for delete
  to authenticated
  using (auth.uid() = host_id);

-- Lobby members
create table public.lobby_members (
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (lobby_id, user_id)
);

create index lobby_members_user_idx on public.lobby_members(user_id);

alter table public.lobby_members enable row level security;

create policy "Members can read lobby membership"
  on public.lobby_members for select
  to authenticated
  using (true);

create policy "Users can join lobby"
  on public.lobby_members for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can leave lobby"
  on public.lobby_members for delete
  to authenticated
  using (auth.uid() = user_id);

-- Realtime: allow authenticated clients to receive broadcasts on channels
-- (Supabase Realtime authorization uses replication; for private channels you may add RLS on realtime.messages in newer setups.)
-- For Broadcast/Presence, ensure Realtime is enabled for the project in Dashboard.

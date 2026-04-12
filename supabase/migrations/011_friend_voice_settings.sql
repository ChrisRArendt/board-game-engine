-- Per-friend voice volume / mute (local to the viewer; persists across sessions)

create table public.friend_voice_settings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  volume real not null default 1.0 check (volume >= 0 and volume <= 2),
  muted boolean not null default false,
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friend_voice_settings enable row level security;

create policy "Users can read own friend voice settings"
  on public.friend_voice_settings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own friend voice settings"
  on public.friend_voice_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own friend voice settings"
  on public.friend_voice_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own friend voice settings"
  on public.friend_voice_settings for delete
  to authenticated
  using (auth.uid() = user_id);

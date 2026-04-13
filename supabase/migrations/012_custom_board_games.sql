-- User-authored board definitions; friends can see and host lobbies with them.

create table public.custom_board_games (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  -- Matches lobbies.game_key (custom_<uuid> without hyphens).
  game_key text generated always as ('custom_' || replace(id::text, '-', '')) stored unique,
  game_data jsonb not null,
  rules_pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_board_games_creator_idx on public.custom_board_games(creator_id);

alter table public.custom_board_games enable row level security;

create policy "Custom games: creator or friend can read"
  on public.custom_board_games for select
  to authenticated
  using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = custom_board_games.creator_id)
        or (f.addressee_id = auth.uid() and f.requester_id = custom_board_games.creator_id)
      )
    )
  );

create policy "Custom games: creator can insert"
  on public.custom_board_games for insert
  to authenticated
  with check (creator_id = auth.uid());

create policy "Custom games: creator can update"
  on public.custom_board_games for update
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "Custom games: creator can delete"
  on public.custom_board_games for delete
  to authenticated
  using (creator_id = auth.uid());

-- Public asset bucket: paths {user_id}/{game_id}/{filename}
insert into storage.buckets (id, name, public)
values ('custom-game-assets', 'custom-game-assets', true)
on conflict (id) do nothing;

create policy "custom-game-assets: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'custom-game-assets');

create policy "custom-game-assets: upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'custom-game-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "custom-game-assets: update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'custom-game-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "custom-game-assets: delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'custom-game-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

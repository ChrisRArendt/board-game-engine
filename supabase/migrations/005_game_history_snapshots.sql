-- Append-only timeline of board state for history slider / replay.

create table public.game_history_snapshots (
  id bigint generated always as identity primary key,
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  snapshot jsonb not null,
  saved_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index game_history_lobby_idx
  on public.game_history_snapshots (lobby_id, created_at asc);

alter table public.game_history_snapshots enable row level security;

create policy "Members can read game history"
  on public.game_history_snapshots for select
  to authenticated
  using (
    exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = game_history_snapshots.lobby_id
        and lm.user_id = auth.uid()
    )
  );

create policy "Members can insert game history"
  on public.game_history_snapshots for insert
  to authenticated
  with check (
    saved_by = auth.uid()
    and exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = game_history_snapshots.lobby_id
        and lm.user_id = auth.uid()
    )
  );

create policy "Members can delete game history"
  on public.game_history_snapshots for delete
  to authenticated
  using (
    exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = game_history_snapshots.lobby_id
        and lm.user_id = auth.uid()
    )
  );

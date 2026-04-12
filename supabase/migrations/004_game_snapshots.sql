-- Persist board state per lobby for resume/rejoin.

create table public.game_snapshots (
  lobby_id uuid primary key references public.lobbies(id) on delete cascade,
  snapshot jsonb not null,
  saved_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index game_snapshots_updated_idx on public.game_snapshots (updated_at desc);

alter table public.game_snapshots enable row level security;

create policy "Members can read snapshot"
  on public.game_snapshots for select
  to authenticated
  using (
    exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = game_snapshots.lobby_id
        and lm.user_id = auth.uid()
    )
  );

create policy "Members can insert snapshot"
  on public.game_snapshots for insert
  to authenticated
  with check (
    saved_by = auth.uid()
    and exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = game_snapshots.lobby_id
        and lm.user_id = auth.uid()
    )
  );

create policy "Members can update snapshot"
  on public.game_snapshots for update
  to authenticated
  using (
    exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = game_snapshots.lobby_id
        and lm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = game_snapshots.lobby_id
        and lm.user_id = auth.uid()
    )
  );

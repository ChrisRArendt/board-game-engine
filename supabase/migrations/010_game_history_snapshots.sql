-- Idempotent: ensures `game_history_snapshots` exists if an earlier migration was skipped or failed remotely.
-- Policies use DO blocks (CREATE POLICY IF NOT EXISTS requires PostgreSQL 15+; not all Supabase projects have it).

create table if not exists public.game_history_snapshots (
  id bigint generated always as identity primary key,
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  snapshot jsonb not null,
  saved_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists game_history_lobby_idx
  on public.game_history_snapshots (lobby_id, created_at asc);

alter table public.game_history_snapshots enable row level security;

do $$
begin
  -- pg_policies is PG15+; use pg_policy + pg_class for PG14-compatible checks
  if not exists (
    select 1
    from pg_policy p
    inner join pg_class c on c.oid = p.polrelid
    inner join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'game_history_snapshots'
      and p.polname = 'Members can read game history'
  ) then
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
  end if;

  if not exists (
    select 1
    from pg_policy p
    inner join pg_class c on c.oid = p.polrelid
    inner join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'game_history_snapshots'
      and p.polname = 'Members can insert game history'
  ) then
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
  end if;

  if not exists (
    select 1
    from pg_policy p
    inner join pg_class c on c.oid = p.polrelid
    inner join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'game_history_snapshots'
      and p.polname = 'Members can delete game history'
  ) then
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
  end if;
end $$;

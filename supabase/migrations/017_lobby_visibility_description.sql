-- Lobby description + visibility; tighten SELECT on non-waiting lobbies.

alter table public.lobbies
  add column if not exists description text default '' not null;

alter table public.lobbies
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'public'));

-- Backfill: existing rows were effectively public in the hub list.
update public.lobbies set visibility = 'public' where visibility = 'private';

drop policy if exists "Authenticated can read lobbies" on public.lobbies;

-- Read access:
-- - Host or member always
-- - Public visibility
-- - Friends visibility: accepted friendship with host
-- - Any authenticated user may read waiting lobbies (join by link / invite; listing is app-filtered)
-- - Non-waiting (playing/finished): not exposed except to host/member/public/friends rules above
create policy "lobbies_select"
  on public.lobbies for select
  to authenticated
  using (
    host_id = auth.uid()
    or exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = lobbies.id and lm.user_id = auth.uid()
    )
    or visibility = 'public'
    or (
      visibility = 'friends'
      and exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = lobbies.host_id)
          or (f.addressee_id = auth.uid() and f.requester_id = lobbies.host_id)
        )
      )
    )
    or status = 'waiting'
  );

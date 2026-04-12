-- Persist player list order per lobby (used in waiting room and in-game sidebar).

alter table public.lobby_members
  add column if not exists sort_order integer not null default 0;

update public.lobby_members lm
set sort_order = sub.rn
from (
  select lobby_id, user_id, row_number() over (partition by lobby_id order by joined_at) as rn
  from public.lobby_members
) sub
where lm.lobby_id = sub.lobby_id and lm.user_id = sub.user_id;

create index if not exists lobby_members_lobby_sort_idx on public.lobby_members (lobby_id, sort_order);

-- Reorder members (any lobby member may call; validates membership and full id set).
create or replace function public.set_lobby_member_order(p_lobby_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_arr_len int;
begin
  if not exists (
    select 1 from public.lobby_members m
    where m.lobby_id = p_lobby_id and m.user_id = auth.uid()
  ) then
    raise exception 'not a member';
  end if;

  select count(*)::int into v_count from public.lobby_members where lobby_id = p_lobby_id;
  v_arr_len := coalesce(array_length(p_user_ids, 1), 0);
  if v_count is distinct from v_arr_len then
    raise exception 'member count mismatch';
  end if;

  if exists (
    select 1 from unnest(p_user_ids) as u(uid)
    where not exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = p_lobby_id and lm.user_id = u.uid
    )
  ) then
    raise exception 'invalid user ids';
  end if;

  if exists (
    select 1 from public.lobby_members lm
    where lm.lobby_id = p_lobby_id
      and lm.user_id not in (select unnest(p_user_ids))
  ) then
    raise exception 'missing user ids';
  end if;

  update public.lobby_members lm
  set sort_order = u.ord::integer
  from (
    select user_id, ord
    from unnest(p_user_ids) with ordinality as u(user_id, ord)
  ) u
  where lm.lobby_id = p_lobby_id and lm.user_id = u.user_id;
end;
$$;

revoke all on function public.set_lobby_member_order(uuid, uuid[]) from public;
grant execute on function public.set_lobby_member_order(uuid, uuid[]) to authenticated;

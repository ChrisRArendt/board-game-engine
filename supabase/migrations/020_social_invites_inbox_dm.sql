-- Lobby invites, notifications inbox, 1:1 DM conversations

-- ---------------------------------------------------------------------------
-- lobby_invites
-- ---------------------------------------------------------------------------
create table public.lobby_invites (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  check (inviter_id <> invitee_id)
);

create unique index lobby_invites_one_pending_per_pair
  on public.lobby_invites (lobby_id, invitee_id)
  where status = 'pending';

create index lobby_invites_invitee_idx on public.lobby_invites (invitee_id);
create index lobby_invites_lobby_idx on public.lobby_invites (lobby_id);

alter table public.lobby_invites enable row level security;

create policy "lobby_invites_select"
  on public.lobby_invites for select
  to authenticated
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

create policy "lobby_invites_insert_host_friend"
  on public.lobby_invites for insert
  to authenticated
  with check (
    auth.uid() = inviter_id
    and exists (
      select 1 from public.lobbies l
      where l.id = lobby_id
        and l.host_id = inviter_id
        and l.status = 'waiting'
    )
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = inviter_id and f.addressee_id = invitee_id)
          or (f.addressee_id = inviter_id and f.requester_id = invitee_id)
        )
    )
    and not exists (
      select 1 from public.lobby_members lm
      where lm.lobby_id = lobby_id and lm.user_id = invitee_id
    )
  );

create policy "lobby_invites_invitee_respond"
  on public.lobby_invites for update
  to authenticated
  using (auth.uid() = invitee_id and status = 'pending')
  with check (
    auth.uid() = invitee_id
    and status in ('accepted', 'declined')
  );

create policy "lobby_invites_inviter_cancel"
  on public.lobby_invites for update
  to authenticated
  using (auth.uid() = inviter_id and status = 'pending')
  with check (auth.uid() = inviter_id and status = 'cancelled');

-- ---------------------------------------------------------------------------
-- notifications (inbox; rows inserted via SECURITY DEFINER triggers / RPC)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('lobby_invite', 'friend_request', 'friend_accept', 'dm')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Trigger: lobby_invite -> notification row
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_lobby_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, payload)
  values (
    new.invitee_id,
    'lobby_invite',
    jsonb_build_object(
      'lobby_id', new.lobby_id,
      'invite_id', new.id,
      'inviter_id', new.inviter_id
    )
  );
  return new;
end;
$$;

create trigger lobby_invites_notify
  after insert on public.lobby_invites
  for each row
  when (new.status = 'pending')
  execute procedure public.trg_notify_lobby_invite();

-- ---------------------------------------------------------------------------
-- conversations + messages + reads
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index conversations_last_idx on public.conversations (last_message_at desc);

alter table public.conversations enable row level security;

create policy "conversations_select_participant"
  on public.conversations for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index conversation_messages_conv_idx
  on public.conversation_messages (conversation_id, created_at);

alter table public.conversation_messages enable row level security;

create policy "conversation_messages_select_participant"
  on public.conversation_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

create policy "conversation_messages_insert_sender"
  on public.conversation_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;

create policy "conversation_reads_select_own"
  on public.conversation_reads for select
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

create policy "conversation_reads_upsert_own"
  on public.conversation_reads for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

create policy "conversation_reads_update_own"
  on public.conversation_reads for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Bump conversation.last_message_at
create or replace function public.trg_conversation_message_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger conversation_messages_touch_conv
  after insert on public.conversation_messages
  for each row
  execute procedure public.trg_conversation_message_touch();

-- DM -> notifications (dedupe unread per conversation)
create or replace function public.trg_notify_dm_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_user uuid;
  ua uuid;
  ub uuid;
  preview text;
  existing_id uuid;
begin
  select user_a, user_b into ua, ub from public.conversations where id = new.conversation_id;
  if new.sender_id = ua then
    other_user := ub;
  else
    other_user := ua;
  end if;

  preview := left(trim(new.body), 160);

  select n.id into existing_id
  from public.notifications n
  where n.user_id = other_user
    and n.kind = 'dm'
    and n.read_at is null
    and coalesce(n.payload->>'conversation_id', '') = new.conversation_id::text
  limit 1;

  if existing_id is not null then
    update public.notifications
    set created_at = now(),
        payload = jsonb_build_object(
          'conversation_id', new.conversation_id,
          'message_id', new.id,
          'sender_id', new.sender_id,
          'preview', preview
        )
    where id = existing_id;
  else
    insert into public.notifications (user_id, kind, payload)
    values (
      other_user,
      'dm',
      jsonb_build_object(
        'conversation_id', new.conversation_id,
        'message_id', new.id,
        'sender_id', new.sender_id,
        'preview', preview
      )
    );
  end if;

  return new;
end;
$$;

create trigger conversation_messages_notify
  after insert on public.conversation_messages
  for each row
  execute procedure public.trg_notify_dm_message();

-- ---------------------------------------------------------------------------
-- dm_open(other_user) -> conversation id
-- ---------------------------------------------------------------------------
create or replace function public.dm_open(_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _a uuid;
  _b uuid;
  _id uuid;
begin
  if _me is null then
    raise exception 'Not authenticated';
  end if;
  if _other is null or _other = _me then
    raise exception 'Invalid peer';
  end if;
  if _me < _other then
    _a := _me;
    _b := _other;
  else
    _a := _other;
    _b := _me;
  end if;

  select id into _id from public.conversations where user_a = _a and user_b = _b;
  if _id is null then
    insert into public.conversations (user_a, user_b)
    values (_a, _b)
    returning id into _id;
  end if;
  return _id;
end;
$$;

grant execute on function public.dm_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Friendships -> inbox (friend_request / friend_accept)
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_friendship_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, kind, payload)
    values (
      new.addressee_id,
      'friend_request',
      jsonb_build_object('friendship_id', new.id, 'requester_id', new.requester_id)
    );
  end if;
  return new;
end;
$$;

create trigger friendships_notify_pending
  after insert on public.friendships
  for each row
  execute procedure public.trg_notify_friendship_insert();

create or replace function public.trg_notify_friendship_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(old.status, '') is distinct from coalesce(new.status, '')
     and new.status = 'accepted' then
    insert into public.notifications (user_id, kind, payload)
    values (
      new.requester_id,
      'friend_accept',
      jsonb_build_object('friendship_id', new.id, 'peer_id', new.addressee_id)
    );
  end if;
  return new;
end;
$$;

create trigger friendships_notify_accept
  after update on public.friendships
  for each row
  execute procedure public.trg_notify_friendship_accept();

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_messages'
  ) then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lobby_invites'
  ) then
    alter publication supabase_realtime add table public.lobby_invites;
  end if;
end $$;

-- Card templates, card instances, and per-game media library

create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.custom_board_games(id) on delete cascade,
  name text not null,
  canvas_width int not null,
  canvas_height int not null,
  border_radius int not null default 0,
  background jsonb not null default '{"type":"solid","color":"#1a1a1a"}'::jsonb,
  layers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index card_templates_game_idx on public.card_templates(game_id);

alter table public.card_templates enable row level security;

create policy "card_templates: creator or friend can read"
  on public.card_templates for select
  to authenticated
  using (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_templates.game_id
      and (
        g.creator_id = auth.uid()
        or exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.addressee_id = g.creator_id)
            or (f.addressee_id = auth.uid() and f.requester_id = g.creator_id)
          )
        )
      )
    )
  );

create policy "card_templates: creator can insert"
  on public.card_templates for insert
  to authenticated
  with check (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_templates.game_id and g.creator_id = auth.uid()
    )
  );

create policy "card_templates: creator can update"
  on public.card_templates for update
  to authenticated
  using (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_templates.game_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_templates.game_id and g.creator_id = auth.uid()
    )
  );

create policy "card_templates: creator can delete"
  on public.card_templates for delete
  to authenticated
  using (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_templates.game_id and g.creator_id = auth.uid()
    )
  );

create table public.card_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.card_templates(id) on delete cascade,
  game_id uuid not null references public.custom_board_games(id) on delete cascade,
  name text not null default '',
  field_values jsonb not null default '{}'::jsonb,
  rendered_image_path text,
  render_stale boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index card_instances_template_idx on public.card_instances(template_id);
create index card_instances_game_idx on public.card_instances(game_id);

alter table public.card_instances enable row level security;

create policy "card_instances: creator or friend can read"
  on public.card_instances for select
  to authenticated
  using (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_instances.game_id
      and (
        g.creator_id = auth.uid()
        or exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.addressee_id = g.creator_id)
            or (f.addressee_id = auth.uid() and f.requester_id = g.creator_id)
          )
        )
      )
    )
  );

create policy "card_instances: creator can insert"
  on public.card_instances for insert
  to authenticated
  with check (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_instances.game_id and g.creator_id = auth.uid()
    )
  );

create policy "card_instances: creator can update"
  on public.card_instances for update
  to authenticated
  using (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_instances.game_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_instances.game_id and g.creator_id = auth.uid()
    )
  );

create policy "card_instances: creator can delete"
  on public.card_instances for delete
  to authenticated
  using (
    exists (
      select 1 from public.custom_board_games g
      where g.id = card_instances.game_id and g.creator_id = auth.uid()
    )
  );

create table public.game_media (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.custom_board_games(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  filename text not null,
  source_type text not null check (source_type in ('upload', 'ai_generated')),
  ai_prompt text,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index game_media_game_idx on public.game_media(game_id);
create index game_media_creator_idx on public.game_media(creator_id);

alter table public.game_media enable row level security;

create policy "game_media: creator or friend can read"
  on public.game_media for select
  to authenticated
  using (
    exists (
      select 1 from public.custom_board_games g
      where g.id = game_media.game_id
      and (
        g.creator_id = auth.uid()
        or exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.addressee_id = g.creator_id)
            or (f.addressee_id = auth.uid() and f.requester_id = g.creator_id)
          )
        )
      )
    )
  );

create policy "game_media: creator can insert"
  on public.game_media for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and exists (
      select 1 from public.custom_board_games g
      where g.id = game_media.game_id and g.creator_id = auth.uid()
    )
  );

create policy "game_media: creator can update"
  on public.game_media for update
  to authenticated
  using (
    creator_id = auth.uid()
    and exists (
      select 1 from public.custom_board_games g
      where g.id = game_media.game_id and g.creator_id = auth.uid()
    )
  )
  with check (
    creator_id = auth.uid()
    and exists (
      select 1 from public.custom_board_games g
      where g.id = game_media.game_id and g.creator_id = auth.uid()
    )
  );

create policy "game_media: creator can delete"
  on public.game_media for delete
  to authenticated
  using (
    creator_id = auth.uid()
    and exists (
      select 1 from public.custom_board_games g
      where g.id = game_media.game_id and g.creator_id = auth.uid()
    )
  );

-- Custom games are publicly playable (any authenticated user can read game data for play / lobby).
-- Editing remains creator-only via existing INSERT/UPDATE/DELETE policies.
-- Editor UI is additionally gated in src/routes/editor/[gameId]/+layout.server.ts

drop policy if exists "Custom games: creator or friend can read" on public.custom_board_games;

create policy "Custom games: authenticated can read"
  on public.custom_board_games for select
  to authenticated
  using (true);

-- Card data must be readable during play for non-friends of the creator.
drop policy if exists "card_templates: creator or friend can read" on public.card_templates;

create policy "card_templates: authenticated can read"
  on public.card_templates for select
  to authenticated
  using (true);

drop policy if exists "card_instances: creator or friend can read" on public.card_instances;

create policy "card_instances: authenticated can read"
  on public.card_instances for select
  to authenticated
  using (true);

drop policy if exists "game_media: creator or friend can read" on public.game_media;

create policy "game_media: authenticated can read"
  on public.game_media for select
  to authenticated
  using (true);

-- Optional cover image path under custom-game-assets: {creator_id}/{game_id}/{filename}

alter table public.custom_board_games
  add column if not exists cover_image_path text;

comment on column public.custom_board_games.cover_image_path is
  'Path in custom-game-assets bucket, e.g. {creator_id}/{game_id}/cover.png';

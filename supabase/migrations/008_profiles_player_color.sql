-- Account-wide player color (Settings → ring & highlights), synced from client.
alter table public.profiles
  add column if not exists player_color text;

comment on column public.profiles.player_color is 'Optional hex #rrggbb for tabletop UI; null uses automatic hue from user id';

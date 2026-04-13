-- Inner corner radius for content clip inside the frame border (null = auto from outer radius − frame width).
alter table public.card_templates
  add column if not exists frame_inner_radius int null;

comment on column public.card_templates.frame_inner_radius is
  'Px radius clipping layers inside the frame; null uses max(0, border_radius - frame_border_width).';

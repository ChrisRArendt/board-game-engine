-- Inset frame border on card templates (drawn inside canvas size via border-box)

alter table public.card_templates
  add column if not exists frame_border_width int not null default 0;

alter table public.card_templates
  add column if not exists frame_border_color text not null default '#000000';

comment on column public.card_templates.frame_border_width is 'Thickness in px; drawn inside canvas_width x canvas_height (content area shrinks).';
comment on column public.card_templates.frame_border_color is 'Solid color for the inset frame border.';

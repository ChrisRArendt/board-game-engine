-- Optional back-face design for card templates (nullable = no back designed).
alter table public.card_templates add column if not exists back_background jsonb;
alter table public.card_templates add column if not exists back_layers jsonb;

comment on column public.card_templates.back_background is 'JSON: same shape as background — solid / gradient / image';
comment on column public.card_templates.back_layers is 'JSON: same shape as layers — array of layer objects';

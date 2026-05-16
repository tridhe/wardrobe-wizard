alter table public.user_items
add column if not exists tags jsonb not null default '{}'::jsonb;

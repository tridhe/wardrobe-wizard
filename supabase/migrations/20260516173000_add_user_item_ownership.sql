alter table public.user_items
add column if not exists user_id uuid references auth.users(id) on delete cascade,
add column if not exists owner_name text;

create index if not exists user_items_user_id_idx on public.user_items(user_id);


create table public.user_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  detail text not null default '',
  image_url text not null,
  created_at timestamptz not null default now()
);
alter table public.user_items enable row level security;
create policy "public read user_items" on public.user_items for select using (true);
create policy "public insert user_items" on public.user_items for insert with check (true);
create policy "public delete user_items" on public.user_items for delete using (true);

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "public read app_settings" on public.app_settings for select using (true);
create policy "public insert app_settings" on public.app_settings for insert with check (true);
create policy "public update app_settings" on public.app_settings for update using (true);

insert into storage.buckets (id, name, public) values ('wardrobe', 'wardrobe', true)
on conflict (id) do nothing;

create policy "wardrobe public read" on storage.objects for select using (bucket_id = 'wardrobe');
create policy "wardrobe public insert" on storage.objects for insert with check (bucket_id = 'wardrobe');
create policy "wardrobe public update" on storage.objects for update using (bucket_id = 'wardrobe');
create policy "wardrobe public delete" on storage.objects for delete using (bucket_id = 'wardrobe');

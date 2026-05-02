create extension if not exists "pgcrypto";

create or replace function public.current_x_handle()
returns text
language sql
stable
as $$
  select lower(
    regexp_replace(
      coalesce(
        auth.jwt() -> 'user_metadata' ->> 'user_name',
        auth.jwt() -> 'user_metadata' ->> 'preferred_username',
        auth.jwt() -> 'user_metadata' ->> 'screen_name',
        split_part(auth.jwt() ->> 'email', '@', 1),
        'unknown'
      ),
      '[^a-zA-Z0-9_]',
      '',
      'g'
    )
  );
$$;

create table if not exists public.fails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  pnl numeric not null check (pnl < 0),
  image_url text,
  story text not null check (char_length(story) between 1 and 340),
  x numeric not null,
  y numeric not null,
  created_at timestamptz not null default now()
);

alter table public.fails enable row level security;

drop policy if exists "Fails are public" on public.fails;
create policy "Fails are public"
on public.fails for select
using (true);

drop policy if exists "Users can insert their own X fails" on public.fails;
create policy "Users can insert their own X fails"
on public.fails for insert
to authenticated
with check (
  auth.uid() = user_id
  and lower(handle) = public.current_x_handle()
  and pnl < 0
);

insert into storage.buckets (id, name, public)
values ('fail-images', 'fail-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Fail images are public" on storage.objects;
create policy "Fail images are public"
on storage.objects for select
using (bucket_id = 'fail-images');

drop policy if exists "Users upload their own fail images" on storage.objects;
create policy "Users upload their own fail images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'fail-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

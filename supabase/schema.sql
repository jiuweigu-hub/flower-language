-- 花之语 Supabase 数据结构
-- 在 Supabase Dashboard > SQL Editor 中完整运行此文件。

create extension if not exists pgcrypto;

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('book', 'thought', 'love', 'imprint')),
  slug text not null unique,
  title text,
  subtitle text,
  body text not null default '',
  excerpt text,
  cover_url text,
  image_urls jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'private', 'public')),
  allow_comments boolean not null default false,
  flower_count integer not null default 0 check (flower_count >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'deleted')),
  created_at timestamptz not null default now()
);

create table if not exists public.flower_events (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  visitor_key text not null,
  created_at timestamptz not null default now(),
  unique (entry_id, visitor_key)
);

create index if not exists entries_public_feed_idx
  on public.entries (type, status, published_at desc);
create index if not exists comments_entry_idx
  on public.comments (entry_id, status, created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entries_touch_updated_at on public.entries;
create trigger entries_touch_updated_at
before update on public.entries
for each row execute function public.touch_updated_at();

create or replace function public.send_flower(target_entry uuid, visitor text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  insert into public.flower_events (entry_id, visitor_key)
  values (target_entry, visitor)
  on conflict (entry_id, visitor_key) do nothing;

  update public.entries
  set flower_count = (
    select count(*)::integer
    from public.flower_events
    where entry_id = target_entry
  )
  where id = target_entry and status = 'public'
  returning flower_count into total;

  return coalesce(total, 0);
end;
$$;

alter table public.entries enable row level security;
alter table public.comments enable row level security;
alter table public.flower_events enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.entries to anon, authenticated;
grant insert, update, delete on public.entries to authenticated;
grant select, insert, update on public.comments to anon, authenticated;
grant insert, select on public.flower_events to anon, authenticated;

drop policy if exists "public reads published entries" on public.entries;
create policy "public reads published entries"
on public.entries for select
using (status = 'public' or auth.uid() = author_id);

drop policy if exists "author creates entries" on public.entries;
create policy "author creates entries"
on public.entries for insert
to authenticated
with check (auth.uid() = author_id);

drop policy if exists "author updates entries" on public.entries;
create policy "author updates entries"
on public.entries for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "author deletes entries" on public.entries;
create policy "author deletes entries"
on public.entries for delete
to authenticated
using (auth.uid() = author_id);

drop policy if exists "public reads approved comments" on public.comments;
create policy "public reads approved comments"
on public.comments for select
using (
  status = 'approved'
  or exists (
    select 1 from public.entries
    where entries.id = comments.entry_id
      and entries.author_id = auth.uid()
  )
);

drop policy if exists "visitor submits pending comments" on public.comments;
create policy "visitor submits pending comments"
on public.comments for insert
to anon, authenticated
with check (
  status = 'pending'
  and exists (
    select 1 from public.entries
    where entries.id = comments.entry_id
      and entries.status = 'public'
      and entries.allow_comments = true
  )
);

drop policy if exists "author moderates comments" on public.comments;
create policy "author moderates comments"
on public.comments for update
to authenticated
using (
  exists (
    select 1 from public.entries
    where entries.id = comments.entry_id
      and entries.author_id = auth.uid()
  )
);

grant execute on function public.send_flower(uuid, text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do update set public = true;

drop policy if exists "public reads content media" on storage.objects;
create policy "public reads content media"
on storage.objects for select
using (bucket_id = 'content-media');

drop policy if exists "author uploads content media" on storage.objects;
create policy "author uploads content media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'content-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "author updates content media" on storage.objects;
create policy "author updates content media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'content-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "author deletes content media" on storage.objects;
create policy "author deletes content media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'content-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

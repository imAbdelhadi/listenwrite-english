create table if not exists public.practices (
  id text primary key,
  title text not null,
  youtube_url text not null,
  youtube_video_id text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_opened_at timestamptz not null,
  current_segment_index integer not null default 0,
  segments jsonb not null default '[]'::jsonb
);

create index if not exists practices_last_opened_at_idx
  on public.practices (last_opened_at desc);

alter table public.practices enable row level security;

drop policy if exists "Public practices are readable" on public.practices;
drop policy if exists "Public practices are insertable" on public.practices;
drop policy if exists "Public practices are updatable" on public.practices;
drop policy if exists "Public practices are deletable" on public.practices;

create policy "Public practices are readable"
  on public.practices for select
  to anon
  using (true);

create policy "Public practices are insertable"
  on public.practices for insert
  to anon
  with check (true);

create policy "Public practices are updatable"
  on public.practices for update
  to anon
  using (true)
  with check (true);

create policy "Public practices are deletable"
  on public.practices for delete
  to anon
  using (true);

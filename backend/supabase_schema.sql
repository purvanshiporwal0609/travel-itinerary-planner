-- Run this in the Supabase SQL editor
create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  request jsonb not null,
  plan jsonb not null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists itineraries_user_idx on public.itineraries(user_id, created_at desc);
alter table public.itineraries enable row level security;
-- The backend uses the service-role key and filters by user_id itself.
-- These policies protect direct client access too:
create policy "own rows" on public.itineraries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

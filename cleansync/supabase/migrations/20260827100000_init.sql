-- CleanSync Phase 1 schema (Supabase / PostgreSQL)
-- Apply in the SQL editor or via `supabase db push`.
-- public.users は世帯メンバー。auth.users とは別。Phase 2 以降で紐付ける。

create extension if not exists "pgcrypto";

do $$ begin
  create type public.reschedule_rule as enum ('NEXT_DAY', 'NEXT_WEEKEND');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_status as enum ('TODO', 'DONE', 'CANCELLED');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_points integer not null default 0,
  color text not null default '#2a9d8f',
  created_at timestamptz not null default now()
);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.task_master (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete restrict,
  name text not null,
  description text not null default '',
  points integer not null check (points > 0),
  reschedule_rule public.reschedule_rule not null default 'NEXT_DAY',
  created_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_master(id) on delete restrict,
  assigned_user_id uuid not null references public.users(id) on delete restrict,
  scheduled_date date not null,
  completed_at timestamptz,
  status public.task_status not null default 'TODO',
  gcal_event_id text,
  reschedule_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists task_events_status_date_idx
  on public.task_events (status, scheduled_date);

create index if not exists task_events_assignee_idx
  on public.task_events (assigned_user_id, scheduled_date);

alter table public.users enable row level security;
alter table public.areas enable row level security;
alter table public.task_master enable row level security;
alter table public.task_events enable row level security;

-- 世帯内アプリ前提の暫定ポリシー。Auth 導入後に household_id で絞る。
drop policy if exists "users_all" on public.users;
create policy "users_all" on public.users for all using (true) with check (true);

drop policy if exists "areas_all" on public.areas;
create policy "areas_all" on public.areas for all using (true) with check (true);

drop policy if exists "task_master_all" on public.task_master;
create policy "task_master_all" on public.task_master for all using (true) with check (true);

drop policy if exists "task_events_all" on public.task_events;
create policy "task_events_all" on public.task_events for all using (true) with check (true);

-- Phase 3: pg_cron 例（拡張が有効なプロジェクトで）
-- select cron.schedule(
--   'cleansync-reschedule',
--   '0 17 * * *',
--   $$ update public.task_events
--      set reschedule_count = reschedule_count + 1,
--          scheduled_date = case
--            when (select reschedule_rule from public.task_master tm where tm.id = task_id) = 'NEXT_WEEKEND'
--              then (scheduled_date + ((6 - extract(dow from scheduled_date)::int + 7) % 7 + 7)::int)
--            else scheduled_date + 1
--          end
--      where status = 'TODO' and scheduled_date <= current_date;
--   $$
-- );

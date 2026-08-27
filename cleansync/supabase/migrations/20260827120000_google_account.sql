-- CleanSync Phase 2: household Google Calendar OAuth tokens
-- 世帯で1行。refresh_token はサービスロールからのみ読む想定。

create table if not exists public.google_account (
  id uuid primary key default gen_random_uuid(),
  email text,
  calendar_id text not null default 'primary',
  refresh_token text,
  access_token text,
  expiry timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.google_account enable row level security;

drop policy if exists "google_account_all" on public.google_account;
create policy "google_account_all" on public.google_account
  for all using (true) with check (true);

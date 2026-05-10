-- 客户表
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  student_type text,
  school text,
  score text,
  source text,
  status text,
  next_contact_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_created_at_idx on public.customers(created_at desc);
create index if not exists customers_status_idx on public.customers(status);

-- 系统设置表：按 key 存储数组，比如 student_types / follow_statuses / sources
create table if not exists public.app_settings (
  key text primary key,
  values text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- 开启 RLS，并允许匿名读写（应用层使用 admin/123456 做访问控制）
alter table public.customers enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "customers_all_access" on public.customers;
create policy "customers_all_access" on public.customers
  for all using (true) with check (true);

drop policy if exists "app_settings_all_access" on public.app_settings;
create policy "app_settings_all_access" on public.app_settings
  for all using (true) with check (true);

-- 自动更新 updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

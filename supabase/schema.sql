-- Схема бази STOtesel. Виконайте один раз у Supabase: SQL Editor → New query → Run.
-- Початкові послуги, запчастини й тексти сайт перенесе сам при першому вході в адмінку.

create extension if not exists pgcrypto;

-- Тексти блоків головної, налаштування (контакти, SEO) і розклад слотів
create table if not exists site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  body text not null default '',
  includes jsonb not null default '[]',
  kind text not null default 'all' check (kind in ('all', 'ice', 'hyb', 'ev')),
  price_from integer not null default 0,
  duration text not null default '',
  enabled boolean not null default true,
  sort integer not null default 0,
  seo_title text not null default '',
  seo_description text not null default ''
);

create table if not exists parts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default '',
  price integer not null default 0,
  in_stock boolean not null default true,
  enabled boolean not null default true,
  sort integer not null default 0
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text not null,
  name text not null default '',
  phone text not null,
  car text not null default '',
  car_type text not null default '',
  vin text not null default '',
  service text not null default '',
  note text not null default '',
  status text not null default 'new' check (status in ('new', 'confirmed', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Один слот не можна зайняти двічі (скасовані заявки слот звільняють)
create unique index if not exists bookings_slot_unique on bookings (date, time) where status <> 'cancelled';
create index if not exists bookings_date_idx on bookings (date);

-- Доступ лише через Worker із service role ключем. Публічних політик немає,
-- тому з anon-ключем прочитати чи змінити ці таблиці не можна.
alter table site_content enable row level security;
alter table services enable row level security;
alter table parts enable row level security;
alter table bookings enable row level security;

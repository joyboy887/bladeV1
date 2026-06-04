-- The Blade — customer booking platform schema (wipe & rebuild)

-- Drop prior objects (existing project had appointments/barbers/services)
drop table if exists public.bookings cascade;
drop table if exists public.appointments cascade;
drop table if exists public.barber_services cascade;
drop table if exists public.closures cascade;
drop table if exists public.barbers cascade;
drop table if exists public.services cascade;
drop table if exists public.shop_settings cascade;

-- shop_settings (singleton, id = 1)
create table public.shop_settings (
  id           int primary key default 1 check (id = 1),
  name         text not null,
  tagline      text not null,
  hero_text    text,
  hero_subtext text,
  phone        text,
  email        text,
  address      text,
  instagram    text,
  currency     text not null default 'GBP',
  timezone     text not null default 'Europe/London',
  notify_phone text,
  notify_email text,
  updated_at   timestamptz not null default now()
);

-- barbers
create table public.barbers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  photo_url    text,
  bio          text,
  phone        text,
  email        text,
  availability jsonb not null default '{}'::jsonb,
  active       boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- services
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  duration_minutes int not null check (duration_minutes > 0),
  price            numeric(10,2) not null check (price >= 0),
  active           boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- barber_services (which barber offers which service)
create table public.barber_services (
  barber_id  uuid not null references public.barbers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (barber_id, service_id)
);

-- bookings
create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  barber_id      uuid not null references public.barbers(id),
  service_id     uuid not null references public.services(id),
  customer_name  text not null,
  customer_phone text not null,
  customer_email text not null,
  booking_date   date not null,
  booking_time   time not null,
  status         text not null default 'confirmed'
                   check (status in ('confirmed','completed','cancelled','no_show')),
  manage_token   uuid not null default gen_random_uuid(),
  notes          text
);

-- Double-booking backstop (cancelled slots can be rebooked)
create unique index bookings_no_double_book
  on public.bookings (barber_id, booking_date, booking_time)
  where status <> 'cancelled';

create index bookings_barber_date_idx
  on public.bookings (barber_id, booking_date);

-- closures (barber_id NULL = whole shop)
create table public.closures (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid references public.barbers(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index closures_date_idx on public.closures (start_date, end_date);

-- Row Level Security
alter table public.shop_settings   enable row level security;
alter table public.barbers         enable row level security;
alter table public.services        enable row level security;
alter table public.barber_services enable row level security;
alter table public.bookings        enable row level security;
alter table public.closures        enable row level security;

-- Public read policies (anon)
create policy "public read shop_settings"
  on public.shop_settings for select to anon, authenticated using (true);

create policy "public read active barbers"
  on public.barbers for select to anon using (active = true);

create policy "public read active services"
  on public.services for select to anon using (active = true);

create policy "public read barber_services"
  on public.barber_services for select to anon using (true);

create policy "public read closures"
  on public.closures for select to anon using (true);

-- Authenticated admin: full access on every table (used in Spec 2)
create policy "admin all shop_settings"
  on public.shop_settings for all to authenticated using (true) with check (true);
create policy "admin all barbers"
  on public.barbers for all to authenticated using (true) with check (true);
create policy "admin all services"
  on public.services for all to authenticated using (true) with check (true);
create policy "admin all barber_services"
  on public.barber_services for all to authenticated using (true) with check (true);
create policy "admin all bookings"
  on public.bookings for all to authenticated using (true) with check (true);
create policy "admin all closures"
  on public.closures for all to authenticated using (true) with check (true);

-- NOTE: no anon policy on bookings. Booking creation goes through the
-- service-role API route only. The service role bypasses RLS.

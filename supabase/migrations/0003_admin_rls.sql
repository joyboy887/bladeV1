-- 0003_admin_rls.sql
-- Defense-in-depth (Task 3b): scope every "authenticated" CRUD policy to verified
-- admins only. Previously each admin policy used `qual = true`, so ANY authenticated
-- JWT had full CRUD via the Supabase REST API, bypassing the app-level ADMIN_EMAILS
-- allowlist. Admins are now keyed by their immutable auth.users UUID via public.admins.
--
-- Notes:
--   * Public (anon) read policies are unchanged — the public site and booking flow
--     use the anon client; the booking insert uses the service-role client, which
--     bypasses RLS. Neither is affected by these changes.
--   * is_admin() is SECURITY DEFINER so it can read public.admins without a recursive
--     RLS check, and reflects the *calling* user via auth.uid().

-- 1. Admin registry, keyed by immutable user UUID (supports "invite staff later").
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Intentionally no anon/authenticated policies: the table is invisible to client
-- roles. It is read only through is_admin() (SECURITY DEFINER) and the service role.

-- 2. Membership helper. SECURITY DEFINER bypasses RLS on admins (no recursion);
--    auth.uid() still resolves to the caller's JWT subject.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3. Seed the current owner.
insert into public.admins (user_id, email)
values ('b03c3855-a287-4ca6-ace2-b5c2c2b2a7fe', 'essienjewel@gmail.com')
on conflict (user_id) do nothing;

-- 4. Re-scope each admin policy from `true` to `public.is_admin()`.
drop policy "admin all bookings" on public.bookings;
create policy "admin all bookings" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "admin all barbers" on public.barbers;
create policy "admin all barbers" on public.barbers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "admin all services" on public.services;
create policy "admin all services" on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "admin all closures" on public.closures;
create policy "admin all closures" on public.closures
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "admin all barber_services" on public.barber_services;
create policy "admin all barber_services" on public.barber_services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "admin all shop_settings" on public.shop_settings;
create policy "admin all shop_settings" on public.shop_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. Storage: same treatment for the media bucket write policies.
drop policy "admin insert media" on storage.objects;
create policy "admin insert media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy "admin update media" on storage.objects;
create policy "admin update media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy "admin delete media" on storage.objects;
create policy "admin delete media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

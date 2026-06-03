-- Public media bucket for barber photos (Spec 2)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Anyone can read media (photos are shown on the public site)
create policy "public read media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');

-- Only authenticated admins can write/replace/remove media
create policy "admin insert media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media');

create policy "admin update media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

create policy "admin delete media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media');

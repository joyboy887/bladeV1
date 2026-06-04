-- Shop settings (single row)
insert into public.shop_settings
  (id, name, tagline, hero_text, hero_subtext, phone, email, address, instagram,
   currency, timezone, notify_phone, notify_email)
values
  (1, 'The Blade Hair Studio', 'Sharp cuts. No riff raff.',
   'Precision cuts in a clean, modern studio.',
   'Book your barber, pick a time, done.',
   '', '', '', '',
   'GBP', 'Europe/London', '', '')
on conflict (id) do update set
  name = excluded.name, tagline = excluded.tagline;

-- Services
insert into public.services (name, description, duration_minutes, price, sort_order) values
  ('Haircut',      'Classic cut and style.',           30, 18.00, 1),
  ('Beard Trim',   'Shape-up and line.',               15, 10.00, 2),
  ('Cut + Beard',  'Full haircut with beard trim.',    45, 25.00, 3),
  ('Skin Fade',    'Detailed skin fade.',              40, 22.00, 4);

-- Barbers with sample weekly availability
insert into public.barbers (name, slug, bio, availability, sort_order) values
  ('Marcus', 'marcus', 'Fades and classic cuts.',
   '{"mon":[{"start":"09:00","end":"17:00"}],"tue":[{"start":"09:00","end":"17:00"}],"wed":[{"start":"09:00","end":"17:00"}],"thu":[{"start":"10:00","end":"19:00"}],"fri":[{"start":"09:00","end":"17:00"}],"sat":[{"start":"09:00","end":"15:00"}],"sun":[]}'::jsonb, 1),
  ('Deon',   'deon',   'Beard specialist and sharp line-ups.',
   '{"mon":[{"start":"10:00","end":"18:00"}],"tue":[{"start":"10:00","end":"18:00"}],"wed":[],"thu":[{"start":"10:00","end":"18:00"}],"fri":[{"start":"10:00","end":"18:00"}],"sat":[{"start":"09:00","end":"16:00"}],"sun":[]}'::jsonb, 2),
  ('Andre',  'andre',  'All styles, all textures.',
   '{"mon":[{"start":"09:00","end":"17:00"}],"tue":[],"wed":[{"start":"09:00","end":"17:00"}],"thu":[{"start":"09:00","end":"17:00"}],"fri":[{"start":"09:00","end":"20:00"}],"sat":[{"start":"09:00","end":"18:00"}],"sun":[]}'::jsonb, 3);

-- Link every barber to every service for v1
insert into public.barber_services (barber_id, service_id)
select b.id, s.id from public.barbers b cross join public.services s;

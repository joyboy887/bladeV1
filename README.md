# The Blade Hair Studio — Booking Platform

Mobile-first barbershop booking site. Next.js (App Router, JavaScript) + Supabase +
Twilio (SMS) + Resend (email). Dark/neon brand. Deploys to Vercel.

## What works (Spec 1)
- Home page (hero, services, barbers, gallery, footer) driven by `shop_settings`.
- Booking flow: barber → service → date → time → details → review → confirm.
- Real availability with double-booking prevention (DB partial-unique index).
- Server-side SMS + email confirmations to customer and owner (fail-soft).
- Confirmation page with booking summary.

## Setup

1. **Install:** `npm install`
2. **Env:** copy `.env.example` to `.env.local` and fill in:
   - **Supabase** → supabase.com → Project Settings → API → Project URL, anon key, service_role key.
   - **Twilio** → twilio.com → Console → Account SID, Auth Token, a sender number.
   - **Resend** → resend.com → API Keys → API key; verify a sending domain or use the test sender for `EMAIL_FROM`.
3. **Database:** the schema + seed live in `supabase/migrations/0001_init.sql` and
   `supabase/seed.sql`. Run them in the Supabase SQL Editor (or via the Supabase MCP).
4. **Images:** real photos live in `pic and images/`. Run `npm run images` to generate
   `public/images/*.webp` (already committed).
5. **Run:** `npm run dev` → http://localhost:3000
6. **Test:** `npm test` (availability engine, formatting, validation).
7. **Build:** `npm run build`

## Deploy to Vercel
Push to GitHub, import the repo in Vercel, add the same env vars in Project Settings,
deploy.

## Notifications without keys
If Twilio/Resend env vars are absent, sends are skipped and logged — the booking still
succeeds. Add keys when ready.

## Placeholders to replace later
- **Barber photos:** none provided; the UI shows styled monogram placeholders
  (`src/components/barber-monogram.js`). Set `barbers.photo_url` (admin upload arrives in
  Spec 2) to replace them.
- **Shop contact details:** the `shop_settings` seed ships with empty phone/email/address/
  instagram and empty `notify_phone`/`notify_email`. Fill these in so owner notifications
  have a destination (admin UI in Spec 2, or update the row directly).

## Architecture notes
- Public pages are Server Components; booking creation goes through `POST /api/bookings`
  (service-role) which re-checks availability and is backed by a DB partial-unique index
  on `(barber_id, booking_date, booking_time)` for race-proof double-booking prevention.
- The availability engine (`src/lib/availability.js`) is pure and unit-tested.
- Timezone and currency come from `shop_settings` (default `Europe/London`, `GBP`).

## Tested
- `npm test` passes (availability, formatting, validation — 16 tests).
- Manual browser pass: home loads; full booking completes; confirmation renders;
  double-booking returns 409; `next build` clean.

## Roadmap
- **Spec 2:** admin dashboard (Supabase Auth, CRUD, bookings management, closures, photo uploads).
- **Spec 3:** reminders (Vercel Cron), analytics, customer history, self-serve reschedule/cancel, calendar export.

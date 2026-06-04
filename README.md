# The Blade Hair Studio — Booking Platform

Mobile-first barbershop booking site. Next.js (App Router, JavaScript) + Supabase +
Twilio (SMS) + Resend (email). Dark/neon brand. Deploys to Vercel.

## What works (Spec 1)
- Home page (hero, services, barbers, gallery, footer) driven by `shop_settings`.
- Booking flow: barber → service → date → time → details → review → confirm.
- Real availability with double-booking prevention (DB partial-unique index).
- Server-side SMS + email confirmations to customer and owner (fail-soft).
- Confirmation page with booking summary.

## What works (Spec 2 — Admin dashboard)
Password-protected, no-code admin at `/admin` (clean light theme, separate from the
dark customer site):
- **Auth:** Supabase Auth (cookie sessions via `@supabase/ssr`); `src/middleware.js`
  plus a per-action `requireAdmin()` gate every `/admin/*` route. Admin access requires
  the user's **confirmed** email to be on the `ADMIN_EMAILS` allowlist (fail-closed) —
  authentication alone is not enough.
- **Bookings:** list with date/barber/status filters; complete, no-show, cancel
  (notifies the customer, frees the slot), reschedule via live availability, and manual
  booking creation for walk-ins/phone.
- **Barbers:** name, photo upload (Supabase Storage `media` bucket), weekly availability
  editor, services-offered, active toggle (auto-generated unique slug for new barbers).
- **Services:** name, duration, price, sort, active toggle.
- **Shop content:** name, tagline, hero text, contact, currency, timezone, owner-notify
  targets — edits revalidate the public site.
- **Closures:** whole-shop or per-barber date ranges.
- **Dashboard home:** today's bookings (shop timezone) + quick counts.

All admin writes go through RLS-scoped Server Actions; the service-role key stays
reserved for the public booking insert only.

## Setup

1. **Install:** `npm install`
2. **Env:** copy `.env.example` to `.env.local` and fill in:
   - **Supabase** → supabase.com → Project Settings → API → Project URL, anon key, service_role key.
   - **`ADMIN_EMAILS`** → comma-separated list of admin emails allowed into `/admin`.
   - **Twilio** → twilio.com → Console → Account SID, Auth Token, a sender number.
   - **Resend** → resend.com → API Keys → API key; verify a sending domain or use the test sender for `EMAIL_FROM`.
3. **Database:** the schema + seed live in `supabase/migrations/0001_init.sql`,
   `supabase/migrations/0002_admin_storage.sql` (the `media` Storage bucket for barber
   photos), and `supabase/seed.sql`. Run them in the Supabase SQL Editor (or via the
   Supabase MCP).
   - **Admin account:** create the owner login with
     `node --env-file=.env.local scripts/create-admin.mjs` (uses the service-role key;
     sets a confirmed email + password). Ensure that email is listed in `ADMIN_EMAILS`.
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
- **Barber photos:** barbers without a photo show styled monogram placeholders
  (`src/components/barber-monogram.js`). Upload a photo per barber in the admin
  (`/admin/barbers`) to replace them.
- **Shop contact details:** the `shop_settings` seed ships with empty phone/email/address/
  instagram and empty `notify_phone`/`notify_email`. Fill these in at `/admin/shop` so
  owner notifications have a destination.

## Architecture notes
- Public pages are Server Components; booking creation goes through `POST /api/bookings`
  (service-role) which re-checks availability and is backed by a DB partial-unique index
  on `(barber_id, booking_date, booking_time)` for race-proof double-booking prevention.
- The availability engine (`src/lib/availability.js`) is pure and unit-tested.
- Timezone and currency come from `shop_settings` (default `Europe/London`, `GBP`).

## Tested
- `npm test` passes (availability, formatting, validation, admin schemas, slug, reschedule — 37 tests).
- Manual browser pass: home loads; full booking completes; confirmation renders;
  double-booking returns 409; `next build` clean.

## Roadmap
- **Spec 3:** reminders (Vercel Cron), analytics, customer history, self-serve reschedule/cancel, calendar export.
- **Security follow-up:** scope RLS to an admin role claim and disable public signup so a
  self-registered authenticated user can't reach data via the Supabase REST API directly
  (the app + middleware already enforce the `ADMIN_EMAILS` allowlist).

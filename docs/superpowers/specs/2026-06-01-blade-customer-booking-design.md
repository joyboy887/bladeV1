# The Blade Hair Studio — Spec 1: Customer Booking Platform

**Date:** 2026-06-01
**Repo:** `bladeV1` (JavaScript, Next.js App Router, deploys to Vercel)
**Status:** Approved design — ready for implementation planning

---

## Context & scope

The Blade Hair Studio is a barbershop that needs a mobile-first booking website,
built to a quality worth selling as a monthly subscription product. Customers pick a
barber, a service, and an available date/time; confirmations go out by email and SMS
to both the customer and the shop. A no-code admin dashboard lets non-technical staff
manage everything.

The full product is decomposed into **three sequential specs**, each with its own
design → plan → build cycle:

- **Spec 1 — Customer Booking Platform (this document)**: database foundation, brand
  + design system, image pipeline, home page, the full booking flow with real
  availability and double-booking prevention, the confirmation page, and server-side
  notification routes. A shippable v1.
- **Spec 2 — Admin Dashboard**: Supabase Auth, CRUD for barbers / services / shop
  content, bookings management, closures editor, Storage photo uploads.
- **Spec 3 — SaaS Features**: automated reminders (Vercel Cron), analytics, customer
  history, self-serve reschedule/cancel links, calendar export.

The **complete database schema** (including `shop_settings` and `closures`) lands in
Spec 1, because the public pages read shop content and the booking flow must respect
closures. The admin UI to *edit* those tables arrives in Spec 2.

### Locked decisions

| Decision | Choice |
|---|---|
| Codebase | Fresh build in `bladeV1`, **JavaScript** (the prior TypeScript `Documents/demo-` project is a reference only) |
| Build order | Customer flow first → admin → SaaS extras |
| Images | Real shop photos provided in `pic and images/` (convert HEIC, crop the two screenshots); styled monogram placeholders for barber portraits |
| Notifications | Build Twilio + Resend routes now; safely no-op when keys are absent |
| Database | Reuse the existing Supabase project (`joyboy887's Project`, ref `uvxnnurkihgkpqwjgxzw`); **wipe and rebuild** the schema per this spec; re-seed barbers/services |
| Timezone | `Europe/London` (default, stored in `shop_settings`) |
| Currency | `GBP` (default, stored in `shop_settings`) |

---

## 1. Data model

Postgres on Supabase. All money stored as `numeric(10,2)`. All times interpreted in
the shop timezone from `shop_settings`.

### `shop_settings` (singleton)
```
id            int primary key default 1 check (id = 1)
name          text not null
tagline       text not null         -- "Sharp cuts. No riff raff."
hero_text     text
hero_subtext  text
phone         text
email         text
address       text
instagram     text
currency      text not null default 'GBP'
timezone      text not null default 'Europe/London'
notify_phone  text                  -- where new-booking SMS alerts go (owner)
notify_email  text                  -- where new-booking email alerts go (owner)
updated_at    timestamptz default now()
```
Single-row table enforced by the `id = 1` check. Drives all public page content so
changes appear with no redeploy.

### `barbers`
```
id            uuid primary key default gen_random_uuid()
name          text not null
slug          text unique not null
photo_url     text
bio           text
phone         text                  -- optional per-barber alert target
email         text                  -- optional per-barber alert target
availability  jsonb not null default '{}'::jsonb
active        boolean not null default true
sort_order    int not null default 0
created_at    timestamptz default now()
```
`availability` shape (weekly recurring hours, shop timezone):
```json
{
  "mon": [{ "start": "09:00", "end": "17:00" }],
  "tue": [{ "start": "09:00", "end": "17:00" }],
  "wed": [],
  "thu": [{ "start": "10:00", "end": "19:00" }],
  "fri": [{ "start": "09:00", "end": "17:00" }],
  "sat": [{ "start": "09:00", "end": "15:00" }],
  "sun": []
}
```
Multiple intervals per day are supported (e.g. a lunch-break split).

### `services`
```
id               uuid primary key default gen_random_uuid()
name             text not null
description      text
duration_minutes int not null
price            numeric(10,2) not null
active           boolean not null default true
sort_order       int not null default 0
created_at       timestamptz default now()
```

### `barber_services` (join — which barber offers which service)
```
barber_id   uuid references barbers(id) on delete cascade
service_id  uuid references services(id) on delete cascade
primary key (barber_id, service_id)
```

### `bookings`
```
id              uuid primary key default gen_random_uuid()
created_at      timestamptz default now()
barber_id       uuid not null references barbers(id)
service_id      uuid not null references services(id)
customer_name   text not null
customer_phone  text not null
customer_email  text not null
booking_date    date not null
booking_time    time not null
status          text not null default 'confirmed'
                  check (status in ('confirmed','completed','cancelled','no_show'))
manage_token    uuid not null default gen_random_uuid()  -- self-serve links (Spec 3)
notes           text
```
Double-booking backstop — partial unique index:
```sql
create unique index bookings_no_double_book
  on bookings (barber_id, booking_date, booking_time)
  where status <> 'cancelled';
```
A cancelled slot can be rebooked; an active one cannot.

### `closures`
```
id          uuid primary key default gen_random_uuid()
barber_id   uuid references barbers(id) on delete cascade   -- NULL = whole shop
start_date  date not null
end_date    date not null
reason      text
created_at  timestamptz default now()
```

### Row Level Security

RLS enabled on every table.

- **anon (public) — read only:** `shop_settings`, active `barbers`, active `services`,
  `barber_services`, `closures`.
- **anon — no direct booking writes.** Booking creation flows exclusively through the
  `POST /api/bookings` server route using the service-role key, which validates input
  and re-checks availability. This is a deliberate, more-secure variation on a raw
  "public can insert bookings" policy: the public *can* book, but only via the
  validated endpoint, which prevents spam and slot manipulation.
- **authenticated (admin) — full access** on all tables (consumed in Spec 2).

### Seed data

Re-seed `shop_settings` (one row with The Blade's real name, tagline, contact),
3 barbers with sample weekly `availability`, 4 services (e.g. Haircut, Beard Trim,
Cut + Beard, Skin Fade) with durations/prices, and `barber_services` links. Seed lives
in `supabase/seed.sql`.

---

## 2. Availability engine — `src/lib/availability.js`

A pure, dependency-light, unit-testable module. Core function:

```
getAvailableSlots({ barber, service, date, existingBookings, closures, now, timezone })
  -> string[]   // e.g. ["09:00","09:30","10:00", ...]
```

Algorithm:
1. Resolve the weekday for `date`; read the barber's working intervals from
   `barber.availability`. No intervals → no slots.
2. If any closure (shop-wide `barber_id IS NULL`, or this barber) covers `date`,
   return no slots.
3. For each working interval, generate candidate start times on a **30-minute grid**
   where `start + service.duration_minutes ≤ interval.end`.
4. Reject any candidate whose `[start, start + duration)` overlaps an existing
   non-cancelled booking for that barber (using each existing booking's own service
   duration for true interval overlap).
5. If `date` is today (shop timezone), drop start times at/just before `now` (apply a
   small lead-time buffer, e.g. 0–15 min).

Timezone handling via `date-fns` + `@date-fns/tz`. The grid step and lead-time buffer
are module constants so they're easy to tune.

---

## 3. Pages & routes

### `/` — Home (Server Component)
Reads `shop_settings`, active `services`, active `barbers`, and gallery images.
Sections:
- **Hero**: neon-sign image, shop name, tagline **"Sharp cuts. No riff raff."**, and a
  prominent **Book Now** CTA.
- **Services overview**: cards from `services` (name, duration, price).
- **Shop vibe / about**: short copy + interior imagery.
- **Gallery**: shop photos + cropped result shots.
- **Footer**: contact info + address from `shop_settings`.

Mobile-first, scales cleanly to desktop.

### `/booking` — Booking wizard (Client Component, URL-synced steps)
Steps, in order, each touch-friendly:
1. **Barber** — cards with name, photo (or monogram placeholder), short bio.
2. **Service** — filtered to the chosen barber's `barber_services`; shows duration + price.
3. **Date** — month calendar; days with no availability or under a closure are disabled.
4. **Time** — live slots from `GET /api/availability`; already-booked slots never appear.
5. **Details** — name, phone, email (validated).
6. **Review → Confirm** — summary, then `POST /api/bookings`.

Barbers + services + `barber_services` are fetched server-side and passed into the
wizard; per-date slots are fetched on demand from the availability route.

### `GET /api/availability`
Query: `barberId`, `serviceId`, `date`. Loads the barber, service, that barber's
non-cancelled bookings for the date, and relevant closures; returns
`{ slots: string[] }` via the availability engine.

### `POST /api/bookings`
Body: `{ barberId, serviceId, customerName, customerPhone, customerEmail, date, time }`.
1. zod-validate the payload.
2. Re-run the availability check server-side; if the slot is no longer free → `409`.
3. Insert the booking with the **service-role** client. A unique-violation from the
   partial index also maps to `409` (race backstop).
4. Fire notifications (customer + owner), failing soft.
5. Return `{ id, manage_token, summary }`.

### `/confirmation` — Confirmation (Server Component)
Query: `id`, `token`. Reads the booking server-side with the service-role client,
verifying `manage_token` matches. Renders an on-brand success message with the booking
summary (barber, service, date, time, customer name) and confirms that email + SMS
confirmations were sent.

---

## 4. Notifications — `src/lib/notifications/`

Server-only modules: `sms.js` (Twilio) and `email.js` (Resend), plus a small
orchestrator invoked by `POST /api/bookings`.

On a successful booking:
- **Customer**: confirmation SMS + email with the booking summary.
- **Owner/shop**: alert SMS + email to `shop_settings.notify_phone` /
  `shop_settings.notify_email` (falling back to the barber's own `phone` / `email`).

Behaviour:
- **Missing credentials → log and no-op.** The booking still succeeds; the flow is
  fully testable without Twilio/Resend accounts.
- A send failure is logged but **never fails the booking** — confirmation still renders.

---

## 5. Branding, design system & image pipeline

### Design system
- Tailwind CSS v4. Near-black background; neon **red `#C8323A`** and **green `#3DB960`**
  as accents with tasteful glow on buttons and key elements (kept fast-loading).
- Bold, confident display headings; clean, readable body text.
- Mobile-first; large touch targets; no horizontal scroll; high contrast; generous
  spacing.
- The `frontend-design` skill is used at build time to keep the result distinctive and
  avoid generic-AI aesthetics.

### Image pipeline
Source assets live in `pic and images/`:
- `03_neon_sign_a_web.jpg` — **brand/hero** ("The Blade Hair Studio" neon, red+green).
- `01_interior_wide_web.jpg`, `02_interior_chairs_web.jpg`, `05_entrance_web.jpg` —
  **vibe + gallery**.
- `IMG_3126.HEIC`, `IMG_3127.HEIC` — finished-cut shots (Instagram screenshots); **crop
  out the phone/IG chrome**, then use in the **gallery**.

Processing: convert HEIC → optimized web format, crop the two screenshots, optimize all,
output to `public/images/`, serve via `next/image`.

**Barber portraits:** none exist. Use a styled monogram placeholder component
(initials on a brand-colored background). Document in the README which images are
placeholders so real photos can be swapped in (and uploaded via admin in Spec 2).

---

## 6. Error handling

- **Slot taken mid-flow** → `409` from `POST /api/bookings`; the UI shows a friendly
  "that slot was just taken — please pick another" and refreshes available times.
- **Invalid input** → zod validation errors surfaced inline in the details step.
- **No availability for a date** → friendly empty state, prompt to try another day.
- **Supabase read errors** → route-level error boundaries (`error.js`).
- **Notification errors** → fail soft; logged, booking unaffected.

---

## 7. Testing

- **Unit tests** (`node --test`) for `availability.js`: grid generation, closure
  handling (shop-wide and per-barber), overlap rejection across variable durations,
  and past-time filtering with timezone.
- **Manual browser verification** before declaring done:
  - Home loads and renders real content/images.
  - Full booking completes end-to-end (barber → confirmation).
  - Confirmation page renders the correct summary.
  - **Double-booking is blocked** (the same slot can't be taken twice).
  - `next build` passes with no errors.
- Results documented in the README.

---

## 8. Project structure & dependencies

```
bladeV1/
  package.json
  next.config.mjs
  jsconfig.json
  postcss.config.mjs
  .env.example
  .gitignore                 (.env.local ignored)
  README.md
  pic and images/            (source assets)
  public/images/             (processed, web-ready)
  supabase/
    migrations/              (schema + RLS)
    seed.sql                 (shop_settings, barbers, services, barber_services)
  src/
    app/
      layout.js
      page.js                (home)
      globals.css
      booking/
        page.js              (+ wizard + step components)
      confirmation/
        page.js
      api/
        availability/route.js
        bookings/route.js
    components/              (hero, gallery, service-card, barber-card, ui/*)
    lib/
      supabase/
        client.js            (browser, anon key)
        server.js            (server, service-role key)
      availability.js
      notifications/
        sms.js               (Twilio)
        email.js             (Resend)
        index.js             (orchestrator)
      validation.js          (zod schemas)
      format.js              (currency, dates, slots)
    config/
      constants.js
```

**Dependencies:** `next`, `react`, `react-dom`, `@supabase/supabase-js`, `zod`,
`date-fns`, `@date-fns/tz`, `twilio`, `resend`, `tailwindcss`, `@tailwindcss/postcss`,
`lucide-react`. Dev: `sharp` (image processing for the pipeline), `eslint`,
`eslint-config-next`, `prettier`.

### `.env.example`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
RESEND_API_KEY=
EMAIL_FROM=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Out of scope for Spec 1 (handled later)

- Admin dashboard / Supabase Auth / Storage uploads → **Spec 2**.
- Automated reminders, analytics, customer history, self-serve reschedule/cancel,
  calendar export → **Spec 3**.
- Multi-tenant / multiple locations → future (schema kept clean to allow it later).

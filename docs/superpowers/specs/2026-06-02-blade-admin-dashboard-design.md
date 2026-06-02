# The Blade — Admin Dashboard (Spec 2) Design

**Status:** Approved (2026-06-02)
**Depends on:** Spec 1 (customer booking flow) — live at https://bladev1.vercel.app
**Builds toward:** Spec 3 (reminders, analytics, self-serve reschedule/cancel, calendar export)

## Goal

A no-code, password-protected admin dashboard that lets the shop owner run The Blade
end to end: manage bookings (view, complete, cancel, no-show, reschedule, create by
hand), barbers (name, photo, availability, services offered, active), services
(name, duration, price, active), shop content, and closures.

## Non-goals (this spec)

- Customer self-serve reschedule/cancel (Spec 3).
- Automated reminders, analytics charts, calendar export (Spec 3).
- Multi-shop tenanting UI (architecture stays tenant-ready; no UI now).
- Staff-invite UI (deferred; architecture supports it — see Auth).
- Hero **image** upload (no DB column; hero text is editable, hero background stays a
  committed asset for v1).
- Server-side image resizing of uploads (keeps `sharp` out of the runtime bundle).
- Multiple availability ranges per weekday (v1 = one open/close range per day).

## Decisions (locked)

| Decision | Choice |
|---|---|
| Admin auth | Single owner now (`essienjewel@gmail.com`), seeded via script; "invite staff later" supported because RLS grants all authenticated users admin access. |
| Bookings ops | Full: view, complete, cancel, no-show, **reschedule**, **manual create**. |
| Reschedule scope | Change date/time + barber (service unchanged). Service change = cancel + re-create. |
| Admin visual style | Clean **light** dashboard, visually separate from the dark customer site. |
| Security/data layer | Authenticated cookie session (`@supabase/ssr`) + RLS + **Server Actions**. Service-role stays reserved for the public booking insert only. |

## Architecture

### Auth
- Supabase Auth (email/password), cookie sessions via `@supabase/ssr`.
- Root `middleware.js` refreshes the session and redirects unauthenticated hits on
  `/admin/*` (except `/admin/login`) to the login page. Matcher: `['/admin/:path*']`.
- Owner account seeded by `scripts/create-admin.mjs`, which calls the Supabase Auth
  admin API (`POST {SUPABASE_URL}/auth/v1/admin/users`) with the **service-role** key,
  `email_confirm: true`, and a password supplied at run time.
- "Invite staff later" needs no schema change: every authenticated user already has
  full admin access via RLS (`0001_init.sql:127-138`). Adding staff = creating more
  auth users.

### Data layer (three clients, clear boundaries)
- **Session client** (new, `src/lib/supabase/ssr.js`) — cookie-bound via `@supabase/ssr`,
  used for **all** admin reads and writes. RLS (`authenticated` role) authorizes.
- **Service-role client** (existing, `server.js`) — unchanged; reserved for the public
  `POST /api/bookings` insert only.
- **Anon client** (existing, `client.js`) — unchanged; public reads.

### Mutations
- Next.js **Server Actions**, one `actions.js` per admin section.
- Every action calls a `requireAdmin()` helper (defense in depth beyond middleware):
  loads the session via the session client, throws/redirects if absent.
- Inputs validated with Zod (extending `src/lib/validation.js`).
- After writes, `revalidatePath()` refreshes admin pages **and** affected public pages
  (`/` and `/booking`) so owner edits show on the live site immediately.

### Photo storage
- One **public** Supabase Storage bucket `media`, created in `0002_admin_storage.sql`
  with `storage.objects` policies: public `select`; `authenticated` `insert/update/delete`.
- Barber photos stored at path `barbers/{barberId}/{timestamp}.{ext}`.
- Upload handled in a Server Action receiving `FormData`; validates type
  (`image/jpeg|png|webp`) and size (≤ 3 MB); stores the public URL in `barbers.photo_url`.
  No server-side resize (display handled by `next/image`).
- `next.config.mjs` gains `images.remotePatterns` for
  `uvxnnurkihgkpqwjgxzw.supabase.co` path `/storage/v1/object/public/**` so `next/image`
  will render the uploaded photos.

## Routes & files

```
middleware.js                                  ← session refresh + /admin gate
next.config.mjs                                ← MODIFY: images.remotePatterns
package.json                                   ← MODIFY: add @supabase/ssr
src/lib/supabase/ssr.js                        ← cookie-bound session client + requireAdmin()
src/lib/data-admin.js                          ← admin read helpers (server-only)
src/lib/slug.js                                ← slugify + unique-suffix helper (pure, tested)
src/lib/validation.js                          ← MODIFY: admin Zod schemas
src/lib/notifications/email.js + sms.js        ← MODIFY: cancellation + reschedule templates

src/app/admin/login/page.js                    ← login form (ungated, outside (dash) group)
src/app/admin/login/actions.js                 ← signIn / signOut
src/app/admin/admin.css                        ← scoped LIGHT theme

src/app/admin/(dash)/layout.js                 ← auth gate + light shell + sidebar nav
src/app/admin/(dash)/page.js                   ← dashboard home (today + quick counts)
src/app/admin/(dash)/bookings/page.js          ← list/filter
src/app/admin/(dash)/bookings/actions.js       ← complete / cancel / no-show
src/app/admin/(dash)/bookings/new/page.js      ← manual booking (walk-in / phone)
src/app/admin/(dash)/bookings/new/actions.js   ← create manual booking
src/app/admin/(dash)/bookings/[id]/reschedule/page.js    ← reschedule via live availability
src/app/admin/(dash)/bookings/[id]/reschedule/actions.js ← perform reschedule
src/app/admin/(dash)/barbers/page.js + actions.js        ← name, photo, availability, services, active
src/app/admin/(dash)/services/page.js + actions.js       ← name, duration, price, active
src/app/admin/(dash)/shop/page.js + actions.js           ← shop_settings editor
src/app/admin/(dash)/closures/page.js + actions.js       ← closures CRUD

src/components/admin/                           ← table, form fields, nav, confirm-button,
                                                  availability-editor, services-multiselect,
                                                  photo-upload-field
supabase/migrations/0002_admin_storage.sql     ← media bucket + storage policies
scripts/create-admin.mjs                        ← seed owner auth user
```

## Data flow

- **Login:** form → `signIn` action → `auth.signInWithPassword` → cookies set →
  `redirect('/admin')`. Bad credentials return an inline error.
- **Protected read:** `(dash)/layout.js` verifies the session (redirect to login if
  none); pages read through the session client; RLS enforces access.
- **Mutation:** form → Server Action → `requireAdmin()` → Zod validate →
  session-client write (RLS) → `revalidatePath('/admin/...', '/', '/booking')` →
  UI updates. Field-level errors returned to the form via `useActionState`.
- **Reschedule / manual create:** action re-runs the pure `getAvailableSlots()` to offer
  valid slots (reschedule excludes the current booking: `status <> 'cancelled' AND
  id <> :currentId`), then writes. The partial-unique index makes it race-proof; a
  `23505` returns a friendly "that slot was just taken" and refreshes the slot list.
  Customer is notified on cancel and on reschedule (fail-soft, existing notifications
  module).

## Build order (each slice independently usable)

1. **Auth foundation** — `@supabase/ssr`, `ssr.js`, `middleware.js`, `requireAdmin()`,
   login page + actions, `(dash)/layout.js` gate, light shell + nav, `scripts/create-admin.mjs`,
   seed owner. → *Can log in to an empty dashboard; logout works; gate blocks anon.*
2. **Shop content editor** — edit `shop_settings`; `revalidatePath('/')`. → *Edits show on site.*
3. **Services CRUD** — create/edit/deactivate; name, duration, price, sort, active.
4. **Barbers CRUD + photo upload** — name (+ slug), photo (Storage), availability editor,
   services-offered multiselect (`barber_services` sync), bio/contact, active.
5. **Closures editor** — create/delete closures (whole-shop or per-barber, date range, reason).
6. **Bookings list + complete + cancel + no-show** — filter by date range / barber / status;
   status actions; cancel notifies customer.
7. **Reschedule + manual create** — reschedule (date/time/barber, availability reuse,
   notify); manual booking (name required, phone/email optional `''`).
8. **Dashboard home** — today's bookings (shop timezone) + quick counts
   (today / upcoming / this week).

## Error handling

- Auth errors inline on the login form.
- Zod field errors surfaced per field on every form (`useActionState`).
- Double-booking conflict (`23505`) on reschedule/manual create → friendly message +
  slot-list refresh.
- Storage upload failure → action aborts, no DB write, error shown; partial upload not
  persisted to `photo_url`.
- Notifications remain fail-soft (no keys / send failure never blocks the write).
- Middleware denies all `/admin/*` except `/admin/login`; actions re-check via `requireAdmin()`.
- Destructive actions (cancel, no-show, deactivate, delete closure) require a confirm
  step (`confirm-button` client component).

## Soft-delete policy

Barbers and services are **deactivated** (`active = false`), never hard-deleted, because
`bookings` reference them via FK — preserving history. Closures are hard-deleted (no FK
dependents). Cancelling a booking sets `status = 'cancelled'` (frees the slot via the
partial-unique index), it is not deleted.

## Testing

- **Automated (`node --test`):** pure logic only —
  - new Zod admin schemas (services, barber, shop, closure, manual booking, reschedule),
  - `slugify` + unique-suffix helper,
  - reschedule self-exclusion helper (the predicate that drops the current booking id
    before calling `getAvailableSlots`).
  Server Actions / DB / auth are **not** unit-tested (require Next runtime + live DB);
  this is stated honestly and covered by the live pass.
- **Live browser pass:** login gate (anon redirected), login/logout, each CRUD area,
  photo upload renders via `next/image`, cancel notifies, reschedule conflict path,
  manual create with empty contact, dashboard "today" in shop timezone.
- `next build` clean before finishing.

## Security

- Service-role key never reaches the browser (unchanged).
- Admin writes are RLS-enforced through the authenticated session client.
- Storage bucket `media`: public read (photos are public on the site), authenticated
  write only.
- Defense in depth: middleware gate **and** per-action `requireAdmin()`.
- `scripts/create-admin.mjs` uses the service-role key locally only; never shipped to the
  client; password entered at run time, not committed.

## Migrations & dependencies summary

- **Add dependency:** `@supabase/ssr`.
- **Migration `0002_admin_storage.sql`:** create public `media` bucket + `storage.objects`
  policies. No table/RLS changes (existing policies already grant authenticated full CRUD).
- **Config:** `next.config.mjs` `images.remotePatterns` for the Supabase storage host.
- **No new required env vars** (session client uses existing `NEXT_PUBLIC_SUPABASE_URL`
  + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; admin seed uses existing `SUPABASE_SERVICE_ROLE_KEY`).

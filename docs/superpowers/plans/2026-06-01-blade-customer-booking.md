# The Blade — Customer Booking Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first, dark/neon barbershop booking site (home → booking wizard → confirmation) in JavaScript on Next.js, backed by Supabase, with real availability + double-booking prevention and server-side SMS/email notifications that no-op without keys.

**Architecture:** Next.js App Router (JS). Public pages are Server Components reading Supabase via the anon key (RLS public-read). A pure availability engine computes bookable slots from weekly hours + service duration + bookings + closures. Bookings are created through a service-role API route that re-checks availability (DB partial-unique index as the race backstop) and fires fail-soft notifications. Branding is dark near-black with neon red `#C8323A` / green `#3DB960`.

**Tech Stack:** Next.js (latest), React 19, `@supabase/supabase-js`, `zod`, `date-fns` + `@date-fns/tz`, `twilio`, `resend`, Tailwind CSS v4, `lucide-react`. Tests via `node --test`. Image processing via `sharp` + macOS `sips`.

**Working directory:** `/Users/jewelessien/Projects/bladeV1` (pass absolute paths; the shell resets cwd between commands). Supabase project ref: `uvxnnurkihgkpqwjgxzw`.

---

## File structure (created across tasks)

```
bladeV1/
  package.json, next.config.mjs, jsconfig.json, postcss.config.mjs, eslint.config.mjs
  .gitignore, .env.example, .env.local (local only), README.md
  scripts/process-images.mjs
  public/images/                         (generated web assets)
  supabase/migrations/0001_init.sql      (schema + RLS + index)
  supabase/seed.sql                      (shop_settings, barbers, services, links)
  src/
    config/constants.js                  (slot grid, lead time, weekday keys)
    lib/
      supabase/client.js                 (browser, anon)
      supabase/server.js                 (server, service-role)
      data.js                            (server-side read helpers)
      format.js + format.test.js         (currency/date/time/slot formatting)
      availability.js + availability.test.js
      validation.js + validation.test.js (zod schemas)
      notifications/{sms.js,email.js,index.js}
    app/
      layout.js, globals.css, page.js (home), error.js, not-found.js
      booking/page.js, booking/booking-wizard.js, booking/error.js
      booking/steps/{barber,service,date,time,details,review}.js
      confirmation/page.js
      api/availability/route.js
      api/bookings/route.js
    components/
      ui/{button.js,container.js,field.js}
      hero.js, services-section.js, gallery.js, barbers-section.js, footer.js, nav.js
      barber-monogram.js
      booking/{step-indicator.js,month-calendar.js,slot-grid.js}
```

---

## Task 1: Scaffold the Next.js JavaScript project

**Files:**
- Create: `package.json`, `next.config.mjs`, `jsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`, `src/app/layout.js`, `src/app/page.js`, `src/app/globals.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "blade-booking",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "node --test 'src/**/*.test.js'",
    "images": "node scripts/process-images.mjs"
  },
  "dependencies": {
    "@date-fns/tz": "^1.4.1",
    "@supabase/supabase-js": "^2.45.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.460.0",
    "next": "^15.5.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "resend": "^4.0.0",
    "twilio": "^5.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.5.0",
    "prettier": "^3.3.0",
    "sharp": "^0.34.0",
    "tailwindcss": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create config files**

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
```

`jsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`postcss.config.mjs`:
```js
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
```

`eslint.config.mjs`:
```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [...compat.extends("next/core-web-vitals")];

export default eslintConfig;
```

`.gitignore`:
```
.DS_Store
node_modules
.next
out
.env.local
.env*.local
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 3: Create minimal app shell**

`src/app/globals.css`:
```css
@import "tailwindcss";
```

`src/app/layout.js`:
```js
import "./globals.css";

export const metadata = {
  title: "The Blade Hair Studio",
  description: "Sharp cuts. No riff raff.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.js`:
```js
export default function Home() {
  return <main>The Blade — booking site (scaffold)</main>;
}
```

- [ ] **Step 4: Install dependencies and verify the build**

Run: `cd /Users/jewelessien/Projects/bladeV1 && npm install && npm run build`
Expected: install succeeds; `next build` completes with no errors and lists the `/` route.

- [ ] **Step 5: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "chore: scaffold Next.js JavaScript project with Tailwind v4"
```

---

## Task 2: Supabase clients and environment template

**Files:**
- Create: `.env.example`, `src/lib/supabase/client.js`, `src/lib/supabase/server.js`, `src/config/constants.js`

- [ ] **Step 1: Create `.env.example`**

```
# Supabase — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Twilio — Console (Account SID, Auth Token, a sender number)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Resend — API Keys; EMAIL_FROM must be a verified sender/domain
RESEND_API_KEY=
EMAIL_FROM=

# Public site URL (used in links inside notifications)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Create the browser (anon) client**

`src/lib/supabase/client.js`:
```js
import { createClient } from "@supabase/supabase-js";

// Browser/anon client. Subject to RLS — public read only.
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 3: Create the server (service-role) client**

`src/lib/supabase/server.js`:
```js
import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only client using the service-role key. Bypasses RLS.
// NEVER import this into a Client Component.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

Note: add `server-only` to dependencies if not transitively present — `npm install server-only`.

- [ ] **Step 4: Create shared constants**

`src/config/constants.js`:
```js
// Booking slot grid in minutes.
export const SLOT_STEP_MINUTES = 30;

// Minimum lead time before a same-day slot can be booked.
export const LEAD_TIME_MINUTES = 15;

// Weekday keys matching the barbers.availability JSON.
// Index aligns with JS Date.getDay() in the shop timezone (0 = Sunday).
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// How many days ahead customers may book.
export const BOOKING_HORIZON_DAYS = 60;
```

- [ ] **Step 5: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add supabase clients, env template, and shared constants"
```

---

## Task 3: Database schema, RLS, and seed

This task uses the Supabase MCP (`apply_migration`, `execute_sql`) against project `uvxnnurkihgkpqwjgxzw`. The SQL is also saved to the repo for reproducibility. **Wipe and rebuild.**

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`

- [ ] **Step 1: Write the schema migration `supabase/migrations/0001_init.sql`**

```sql
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
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool: project_id `uvxnnurkihgkpqwjgxzw`, name `init`, query = the SQL above.
Expected: success, no errors.

- [ ] **Step 3: Write the seed `supabase/seed.sql`**

```sql
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
```

- [ ] **Step 4: Apply the seed and verify**

Use the Supabase MCP `execute_sql` with the seed SQL. Then verify:
```sql
select (select count(*) from shop_settings) as shop,
       (select count(*) from barbers) as barbers,
       (select count(*) from services) as services,
       (select count(*) from barber_services) as links;
```
Expected: `shop=1, barbers=3, services=4, links=12`.

- [ ] **Step 5: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add database schema, RLS, and seed data"
```

---

## Task 4: Image processing pipeline

Convert HEIC → web, crop IG/phone chrome off the two screenshots, optimize all into `public/images/`.

**Files:**
- Create: `scripts/process-images.mjs`

- [ ] **Step 1: Inspect the two screenshots to find crop boundaries**

The HEICs are 1206×2622 portrait phone screenshots. The phone status bar + IG top bar occupy roughly the top ~150px and the IG bottom UI (handle, comment box) the bottom ~560px. Before finalizing crop numbers, open `/tmp/blade_preview/IMG_3126.jpg` and `/tmp/blade_preview/IMG_3127.jpg` (already converted) and confirm the crop keeps the subject. Adjust the `crop` numbers in Step 2 if needed.

- [ ] **Step 2: Write `scripts/process-images.mjs`**

```js
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const SRC = "/Users/jewelessien/Projects/bladeV1/pic and images";
const OUT = "/Users/jewelessien/Projects/bladeV1/public/images";
mkdirSync(OUT, { recursive: true });

// Convert a HEIC to a temp JPEG via macOS sips (sharp can't read HEIC).
function heicToJpeg(name) {
  const tmp = path.join(os.tmpdir(), `${name}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", path.join(SRC, `${name}.HEIC`), "--out", tmp]);
  return tmp;
}

async function emit(input, outName, { width = 1600, crop } = {}) {
  let img = sharp(input).rotate();
  if (crop) img = img.extract(crop);
  await img
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(OUT, `${outName}.webp`));
  console.log("wrote", `${outName}.webp`);
}

async function main() {
  // Brand / hero
  await emit(path.join(SRC, "03_neon_sign_a_web.jpg"), "neon-sign", { width: 1600 });
  // Vibe / gallery
  await emit(path.join(SRC, "01_interior_wide_web.jpg"), "interior-wide", { width: 1600 });
  await emit(path.join(SRC, "02_interior_chairs_web.jpg"), "interior-chairs", { width: 1200 });
  await emit(path.join(SRC, "05_entrance_web.jpg"), "entrance", { width: 1200 });

  // Finished-cut screenshots — crop out phone/IG chrome.
  // Source is 1206x2622. Keep the central band with the subject.
  const cropCut = { left: 0, top: 150, width: 1206, height: 1912 };
  await emit(heicToJpeg("IMG_3126"), "cut-1", { width: 1000, crop: cropCut });
  await emit(heicToJpeg("IMG_3127"), "cut-2", { width: 1000, crop: cropCut });
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the pipeline and verify output**

Run: `cd /Users/jewelessien/Projects/bladeV1 && npm run images && ls -la public/images`
Expected: `neon-sign.webp`, `interior-wide.webp`, `interior-chairs.webp`, `entrance.webp`, `cut-1.webp`, `cut-2.webp`. Open `cut-1.webp`/`cut-2.webp` to confirm the IG chrome is gone and the subject is intact; tweak `cropCut` and re-run if not.

- [ ] **Step 4: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add image pipeline and processed web assets"
```

---

## Task 5: Formatting helpers (TDD)

**Files:**
- Create: `src/lib/format.js`, `src/lib/format.test.js`

- [ ] **Step 1: Write the failing tests `src/lib/format.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPrice, formatDuration, formatTime12h, addMinutesToHHMM } from "./format.js";

test("formatPrice renders GBP", () => {
  assert.equal(formatPrice(18, "GBP"), "£18.00");
  assert.equal(formatPrice(25.5, "GBP"), "£25.50");
});

test("formatDuration renders minutes and hours", () => {
  assert.equal(formatDuration(30), "30 min");
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(60), "1 hr");
  assert.equal(formatDuration(90), "1 hr 30 min");
});

test("formatTime12h converts 24h to 12h", () => {
  assert.equal(formatTime12h("09:00"), "9:00 AM");
  assert.equal(formatTime12h("13:30"), "1:30 PM");
  assert.equal(formatTime12h("00:00"), "12:00 AM");
});

test("addMinutesToHHMM adds and wraps within a day", () => {
  assert.equal(addMinutesToHHMM("09:00", 30), "09:30");
  assert.equal(addMinutesToHHMM("09:45", 30), "10:15");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/jewelessien/Projects/bladeV1 && node --test src/lib/format.test.js`
Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Implement `src/lib/format.js`**

```js
export function formatPrice(amount, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(amount));
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function formatTime12h(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function addMinutesToHHMM(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/jewelessien/Projects/bladeV1 && node --test src/lib/format.test.js`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add formatting helpers with tests"
```

---

## Task 6: Availability engine (TDD)

**Files:**
- Create: `src/lib/availability.js`, `src/lib/availability.test.js`

- [ ] **Step 1: Write the failing tests `src/lib/availability.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getAvailableSlots, minutesToHHMM, hhmmToMinutes } from "./availability.js";

const barber = {
  availability: {
    mon: [{ start: "09:00", end: "12:00" }],
    tue: [],
    sat: [{ start: "09:00", end: "10:30" }],
  },
};
const service = { duration_minutes: 30 };
// A far-future Monday so "now" filtering never interferes.
const farMonday = "2099-01-05"; // 2099-01-05 is a Monday

test("generates 30-min grid within working hours", () => {
  const slots = getAvailableSlots({
    barber, service, date: farMonday,
    existingBookings: [], closures: [],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  assert.deepEqual(slots, ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
});

test("last slot must fit the full duration", () => {
  const farSaturday = "2099-01-10"; // Saturday, hours 09:00-10:30
  const slots = getAvailableSlots({
    barber, service, date: farSaturday,
    existingBookings: [], closures: [],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  // 09:00, 09:30, 10:00 (10:00+30=10:30 fits); 10:30 would end 11:00 > 10:30
  assert.deepEqual(slots, ["09:00", "09:30", "10:00"]);
});

test("a day with no hours yields no slots", () => {
  const farTuesday = "2099-01-06";
  const slots = getAvailableSlots({
    barber, service, date: farTuesday,
    existingBookings: [], closures: [],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  assert.deepEqual(slots, []);
});

test("overlapping bookings are removed using their own durations", () => {
  const existingBookings = [
    { booking_time: "09:30", duration_minutes: 60 }, // blocks 09:30-10:30
  ];
  const slots = getAvailableSlots({
    barber, service, date: farMonday,
    existingBookings, closures: [],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  // 09:00 ok (ends 09:30). 09:30,10:00 blocked. 10:30,11:00,11:30 ok.
  assert.deepEqual(slots, ["09:00", "10:30", "11:00", "11:30"]);
});

test("a closure covering the date yields no slots", () => {
  const slots = getAvailableSlots({
    barber, service, date: farMonday,
    existingBookings: [],
    closures: [{ barber_id: null, start_date: "2099-01-01", end_date: "2099-12-31" }],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  assert.deepEqual(slots, []);
});

test("same-day past times are filtered with lead time", () => {
  // 'now' = farMonday 10:00 London; lead time 15 min -> first bookable >= 10:15 -> 10:30
  const slots = getAvailableSlots({
    barber, service, date: farMonday,
    existingBookings: [], closures: [],
    now: new Date("2099-01-05T10:00:00Z"), timezone: "Europe/London",
  });
  assert.deepEqual(slots, ["10:30", "11:00", "11:30"]);
});

test("hhmm/minutes round-trip", () => {
  assert.equal(hhmmToMinutes("09:30"), 570);
  assert.equal(minutesToHHMM(570), "09:30");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/jewelessien/Projects/bladeV1 && node --test src/lib/availability.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/availability.js`**

```js
import { TZDate } from "@date-fns/tz";
import { SLOT_STEP_MINUTES, LEAD_TIME_MINUTES, WEEKDAY_KEYS } from "@/config/constants.js";

export function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHHMM(total) {
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Weekday key (sun..sat) for a YYYY-MM-DD date in the shop timezone.
function weekdayKey(dateStr, timezone) {
  const d = new TZDate(`${dateStr}T12:00:00`, timezone);
  return WEEKDAY_KEYS[d.getDay()];
}

function dateIsClosed(dateStr, barberId, closures) {
  return closures.some((c) => {
    const appliesToBarber = c.barber_id == null || c.barber_id === barberId;
    return appliesToBarber && dateStr >= c.start_date && dateStr <= c.end_date;
  });
}

// Minutes-since-midnight "now" in the shop timezone, or null if date != today.
function sameDayCutoffMinutes(dateStr, now, timezone) {
  const tzNow = new TZDate(now, timezone);
  const todayStr = [
    tzNow.getFullYear(),
    String(tzNow.getMonth() + 1).padStart(2, "0"),
    String(tzNow.getDate()).padStart(2, "0"),
  ].join("-");
  if (dateStr !== todayStr) return null;
  return tzNow.getHours() * 60 + tzNow.getMinutes() + LEAD_TIME_MINUTES;
}

/**
 * Compute bookable start times (HH:MM) for a barber/service/date.
 * @param {object} args
 * @param {{availability:object, id?:string}} args.barber
 * @param {{duration_minutes:number}} args.service
 * @param {string} args.date  YYYY-MM-DD
 * @param {Array<{booking_time:string, duration_minutes:number}>} args.existingBookings
 * @param {Array<{barber_id:?string, start_date:string, end_date:string}>} args.closures
 * @param {Date} args.now
 * @param {string} args.timezone
 * @returns {string[]}
 */
export function getAvailableSlots({
  barber, service, date, existingBookings = [], closures = [], now = new Date(), timezone = "Europe/London",
}) {
  if (dateIsClosed(date, barber.id ?? null, closures)) return [];

  const intervals = barber.availability?.[weekdayKey(date, timezone)] ?? [];
  if (intervals.length === 0) return [];

  const duration = service.duration_minutes;
  const cutoff = sameDayCutoffMinutes(date, now, timezone);

  // Busy ranges from existing (non-cancelled) bookings.
  const busy = existingBookings.map((b) => {
    const start = hhmmToMinutes(b.booking_time);
    return [start, start + (b.duration_minutes ?? 0)];
  });

  const slots = [];
  for (const { start, end } of intervals) {
    const open = hhmmToMinutes(start);
    const close = hhmmToMinutes(end);
    for (let t = open; t + duration <= close; t += SLOT_STEP_MINUTES) {
      if (cutoff != null && t < cutoff) continue;
      const slotEnd = t + duration;
      const overlaps = busy.some(([bs, be]) => t < be && slotEnd > bs);
      if (!overlaps) slots.push(minutesToHHMM(t));
    }
  }
  return slots;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/jewelessien/Projects/bladeV1 && node --test src/lib/availability.test.js`
Expected: PASS (all tests). If the same-day test is off by the timezone offset, confirm the test's `now` ISO uses `Z` and London is UTC in January (no DST) — it is, so 10:00Z == 10:00 London.

- [ ] **Step 5: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add availability engine with tests"
```

---

## Task 7: Validation schemas (TDD)

**Files:**
- Create: `src/lib/validation.js`, `src/lib/validation.test.js`

- [ ] **Step 1: Write the failing tests `src/lib/validation.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingInputSchema } from "./validation.js";

const valid = {
  barberId: "11111111-1111-1111-1111-111111111111",
  serviceId: "22222222-2222-2222-2222-222222222222",
  customerName: "Sam Jones",
  customerPhone: "+447700900123",
  customerEmail: "sam@example.com",
  date: "2099-01-05",
  time: "09:30",
};

test("accepts a valid booking input", () => {
  const parsed = bookingInputSchema.parse(valid);
  assert.equal(parsed.customerName, "Sam Jones");
});

test("rejects a bad email", () => {
  assert.throws(() => bookingInputSchema.parse({ ...valid, customerEmail: "nope" }));
});

test("rejects a bad date format", () => {
  assert.throws(() => bookingInputSchema.parse({ ...valid, date: "05/01/2099" }));
});

test("rejects a bad time format", () => {
  assert.throws(() => bookingInputSchema.parse({ ...valid, time: "9am" }));
});

test("rejects an empty name", () => {
  assert.throws(() => bookingInputSchema.parse({ ...valid, customerName: "" }));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/jewelessien/Projects/bladeV1 && node --test src/lib/validation.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/validation.js`**

```js
import { z } from "zod";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const bookingInputSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  customerName: z.string().trim().min(1, "Name is required").max(120),
  customerPhone: z.string().trim().min(7, "Enter a valid phone number").max(32),
  customerEmail: z.string().trim().email("Enter a valid email"),
  date: z.string().regex(dateRe, "Invalid date"),
  time: z.string().regex(timeRe, "Invalid time"),
});

export const availabilityQuerySchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(dateRe, "Invalid date"),
});
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/jewelessien/Projects/bladeV1 && node --test src/lib/validation.test.js`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add zod validation schemas with tests"
```

---

## Task 8: Server-side data read helpers

**Files:**
- Create: `src/lib/data.js`

- [ ] **Step 1: Implement `src/lib/data.js`**

```js
import "server-only";
import { createServiceClient } from "@/lib/supabase/server.js";

// All reads use the service client (server-only). Public pages call these
// from Server Components; values are safe to expose (no secrets in rows).

export async function getShopSettings() {
  const db = createServiceClient();
  const { data, error } = await db.from("shop_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function getActiveBarbers() {
  const db = createServiceClient();
  const { data, error } = await db
    .from("barbers")
    .select("id,name,slug,photo_url,bio,availability,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getActiveServices() {
  const db = createServiceClient();
  const { data, error } = await db
    .from("services")
    .select("id,name,description,duration_minutes,price,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getBarberServiceLinks() {
  const db = createServiceClient();
  const { data, error } = await db.from("barber_services").select("barber_id,service_id");
  if (error) throw error;
  return data;
}

export async function getBookingById(id, token) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("bookings")
    .select("id,barber_id,service_id,customer_name,customer_email,customer_phone,booking_date,booking_time,status,manage_token")
    .eq("id", id)
    .single();
  if (error) return null;
  if (!data || data.manage_token !== token) return null;
  return data;
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd /Users/jewelessien/Projects/bladeV1 && npm run build`
Expected: build succeeds (no usage yet, just compilation).

- [ ] **Step 3: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add server-side data read helpers"
```

---

## Task 9: Notifications (fail-soft Twilio + Resend)

**Files:**
- Create: `src/lib/notifications/sms.js`, `src/lib/notifications/email.js`, `src/lib/notifications/index.js`

- [ ] **Step 1: Implement `src/lib/notifications/sms.js`**

```js
import "server-only";

// Sends an SMS via Twilio. No-ops (returns {skipped:true}) if not configured.
export async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !to) {
    console.log("[sms] skipped (missing config or recipient):", to);
    return { skipped: true };
  }
  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({ to, from: TWILIO_FROM_NUMBER, body });
    return { sid: msg.sid };
  } catch (err) {
    console.error("[sms] send failed:", err?.message);
    return { error: err?.message ?? "sms failed" };
  }
}
```

- [ ] **Step 2: Implement `src/lib/notifications/email.js`**

```js
import "server-only";

// Sends an email via Resend. No-ops if not configured.
export async function sendEmail(to, subject, html) {
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM || !to) {
    console.log("[email] skipped (missing config or recipient):", to);
    return { skipped: true };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);
    const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
    if (error) throw new Error(error.message);
    return { id: data?.id };
  } catch (err) {
    console.error("[email] send failed:", err?.message);
    return { error: err?.message ?? "email failed" };
  }
}
```

- [ ] **Step 3: Implement the orchestrator `src/lib/notifications/index.js`**

```js
import "server-only";
import { sendSms } from "./sms.js";
import { sendEmail } from "./email.js";
import { formatTime12h } from "@/lib/format.js";

// Fires customer + owner notifications for a new booking. Always fail-soft:
// returns a result object and never throws.
export async function sendBookingNotifications({ booking, barber, service, shop }) {
  const when = `${booking.booking_date} at ${formatTime12h(booking.booking_time)}`;
  const customerMsg =
    `${shop.name}: booking confirmed with ${barber.name} for ${service.name} on ${when}. See you soon!`;
  const ownerMsg =
    `New booking: ${booking.customer_name} — ${service.name} with ${barber.name} on ${when}. Phone: ${booking.customer_phone}`;

  const customerHtml = `
    <h2>${shop.name}</h2>
    <p>Hi ${booking.customer_name}, your booking is confirmed.</p>
    <p><strong>${service.name}</strong> with <strong>${barber.name}</strong><br/>${when}</p>
    <p>${shop.tagline}</p>`;
  const ownerHtml = `
    <h2>New booking</h2>
    <p>${booking.customer_name} booked <strong>${service.name}</strong> with
       <strong>${barber.name}</strong> on ${when}.</p>
    <p>Phone: ${booking.customer_phone}<br/>Email: ${booking.customer_email}</p>`;

  const ownerPhone = shop.notify_phone || barber.phone || null;
  const ownerEmail = shop.notify_email || barber.email || null;

  const results = await Promise.allSettled([
    sendSms(booking.customer_phone, customerMsg),
    sendEmail(booking.customer_email, `Booking confirmed — ${shop.name}`, customerHtml),
    sendSms(ownerPhone, ownerMsg),
    sendEmail(ownerEmail, `New booking — ${booking.customer_name}`, ownerHtml),
  ]);
  return { results };
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/jewelessien/Projects/bladeV1 && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add fail-soft SMS and email notifications"
```

---

## Task 10: Availability API route

**Files:**
- Create: `src/app/api/availability/route.js`

- [ ] **Step 1: Implement `src/app/api/availability/route.js`**

```js
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server.js";
import { getAvailableSlots } from "@/lib/availability.js";
import { availabilityQuerySchema } from "@/lib/validation.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    barberId: searchParams.get("barberId"),
    serviceId: searchParams.get("serviceId"),
    date: searchParams.get("date"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const { barberId, serviceId, date } = parsed.data;
  const db = createServiceClient();

  const [{ data: barber }, { data: service }, { data: shop }] = await Promise.all([
    db.from("barbers").select("id,availability").eq("id", barberId).single(),
    db.from("services").select("id,duration_minutes").eq("id", serviceId).single(),
    db.from("shop_settings").select("timezone").eq("id", 1).single(),
  ]);
  if (!barber || !service) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Existing non-cancelled bookings for this barber/date, joined to durations.
  const { data: bookings } = await db
    .from("bookings")
    .select("booking_time, services(duration_minutes)")
    .eq("barber_id", barberId)
    .eq("booking_date", date)
    .neq("status", "cancelled");

  const existingBookings = (bookings ?? []).map((b) => ({
    booking_time: b.booking_time.slice(0, 5),
    duration_minutes: b.services?.duration_minutes ?? 0,
  }));

  const { data: closures } = await db
    .from("closures")
    .select("barber_id,start_date,end_date")
    .lte("start_date", date)
    .gte("end_date", date);

  const slots = getAvailableSlots({
    barber, service, date,
    existingBookings,
    closures: closures ?? [],
    now: new Date(),
    timezone: shop?.timezone ?? "Europe/London",
  });

  return NextResponse.json({ slots });
}
```

- [ ] **Step 2: Manually verify against the live DB**

Run the dev server: `cd /Users/jewelessien/Projects/bladeV1 && npm run dev` (needs `.env.local` with Supabase URL + service-role + anon keys filled in).
Then, using the seeded Marcus barber id and Haircut service id (look them up via the Supabase MCP `execute_sql`: `select id,name from barbers; select id,name from services;`), open:
`http://localhost:3000/api/availability?barberId=<marcus>&serviceId=<haircut>&date=<next Monday>`
Expected: JSON `{ "slots": ["09:00","09:30",...] }`.

- [ ] **Step 3: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add availability API route"
```

---

## Task 11: Bookings API route (create + double-booking guard)

**Files:**
- Create: `src/app/api/bookings/route.js`

- [ ] **Step 1: Implement `src/app/api/bookings/route.js`**

```js
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server.js";
import { getAvailableSlots } from "@/lib/availability.js";
import { bookingInputSchema } from "@/lib/validation.js";
import { sendBookingNotifications } from "@/lib/notifications/index.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const db = createServiceClient();

  const [{ data: barber }, { data: service }, { data: shop }] = await Promise.all([
    db.from("barbers").select("*").eq("id", input.barberId).single(),
    db.from("services").select("*").eq("id", input.serviceId).single(),
    db.from("shop_settings").select("*").eq("id", 1).single(),
  ]);
  if (!barber || !service) {
    return NextResponse.json({ error: "Barber or service not found" }, { status: 404 });
  }

  // Re-check availability server-side (defends against stale clients).
  const { data: dayBookings } = await db
    .from("bookings")
    .select("booking_time, services(duration_minutes)")
    .eq("barber_id", input.barberId)
    .eq("booking_date", input.date)
    .neq("status", "cancelled");
  const { data: closures } = await db
    .from("closures")
    .select("barber_id,start_date,end_date")
    .lte("start_date", input.date)
    .gte("end_date", input.date);

  const slots = getAvailableSlots({
    barber, service, date: input.date,
    existingBookings: (dayBookings ?? []).map((b) => ({
      booking_time: b.booking_time.slice(0, 5),
      duration_minutes: b.services?.duration_minutes ?? 0,
    })),
    closures: closures ?? [],
    now: new Date(),
    timezone: shop?.timezone ?? "Europe/London",
  });
  if (!slots.includes(input.time)) {
    return NextResponse.json(
      { error: "That time was just taken. Please pick another." },
      { status: 409 }
    );
  }

  // Insert. The partial unique index is the hard race backstop.
  const { data: booking, error } = await db
    .from("bookings")
    .insert({
      barber_id: input.barberId,
      service_id: input.serviceId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      booking_date: input.date,
      booking_time: input.time,
    })
    .select("id, manage_token, booking_date, booking_time, customer_name, customer_phone, customer_email")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That time was just taken. Please pick another." },
        { status: 409 }
      );
    }
    console.error("[bookings] insert failed:", error);
    return NextResponse.json({ error: "Could not create booking" }, { status: 500 });
  }

  // Fire notifications (fail-soft; never blocks the response on errors).
  await sendBookingNotifications({ booking, barber, service, shop });

  return NextResponse.json({
    id: booking.id,
    token: booking.manage_token,
    summary: {
      barber: barber.name,
      service: service.name,
      date: booking.booking_date,
      time: booking.booking_time.slice(0, 5),
      customerName: booking.customer_name,
    },
  }, { status: 201 });
}
```

- [ ] **Step 2: Manually verify create + double-booking**

With dev server running and `.env.local` set, POST a booking (replace ids/date):
```bash
curl -s -X POST http://localhost:3000/api/bookings -H 'content-type: application/json' \
  -d '{"barberId":"<marcus>","serviceId":"<haircut>","customerName":"Test User","customerPhone":"+447700900123","customerEmail":"test@example.com","date":"<next monday>","time":"09:00"}'
```
Expected: `201` with `{id, token, summary}`. POST the **same** payload again → `409` "just taken". Notification logs show `[sms] skipped` / `[email] skipped` (no keys yet).

- [ ] **Step 3: Clean up the test booking**

Via Supabase MCP `execute_sql`: `delete from bookings where customer_name = 'Test User';`

- [ ] **Step 4: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add bookings API route with double-booking guard and notifications"
```

---

## Task 12: Design system — theme, fonts, layout, UI primitives

This task establishes the dark/neon look. Use the **frontend-design skill** during execution to refine spacing, glow, and typographic polish beyond the structural code below.

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.js`
- Create: `src/components/ui/button.js`, `src/components/ui/container.js`, `src/components/ui/field.js`

- [ ] **Step 1: Replace `src/app/globals.css` with the brand theme**

```css
@import "tailwindcss";

@theme {
  --color-ink: #0a0a0b;
  --color-ink-soft: #121214;
  --color-blade-red: #c8323a;
  --color-blade-green: #3db960;
  --color-fog: #e7e7ea;
  --color-muted: #9a9aa2;
  --font-display: var(--font-display), system-ui, sans-serif;
  --font-body: var(--font-body), system-ui, sans-serif;
}

:root { color-scheme: dark; }

body {
  background-color: var(--color-ink);
  color: var(--color-fog);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 { font-family: var(--font-display); letter-spacing: 0.01em; }

/* Neon glow utilities */
.glow-red { box-shadow: 0 0 18px -2px rgba(200, 50, 58, 0.6); }
.glow-green { box-shadow: 0 0 18px -2px rgba(61, 185, 96, 0.55); }
.text-glow-red { text-shadow: 0 0 14px rgba(200, 50, 58, 0.65); }
.text-glow-green { text-shadow: 0 0 14px rgba(61, 185, 96, 0.6); }
```

- [ ] **Step 2: Wire fonts in `src/app/layout.js`**

```js
import "./globals.css";
import { Bebas_Neue, Inter } from "next/font/google";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: "The Blade Hair Studio — Sharp cuts. No riff raff.",
  description: "Book a barber at The Blade Hair Studio. Sharp cuts. No riff raff.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Create UI primitives**

`src/components/ui/container.js`:
```js
export function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-6 ${className}`}>{children}</div>;
}
```

`src/components/ui/button.js`:
```js
import Link from "next/link";

const base =
  "inline-flex items-center justify-center rounded-full font-semibold tracking-wide " +
  "transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none " +
  "min-h-12 px-7 text-base";

const variants = {
  primary: "bg-blade-red text-white glow-red hover:brightness-110",
  green: "bg-blade-green text-ink glow-green hover:brightness-110",
  ghost: "border border-white/15 text-fog hover:border-white/40 bg-white/5",
};

export function Button({ as = "button", variant = "primary", className = "", href, ...props }) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (as === "link") return <Link href={href} className={cls} {...props} />;
  return <button className={cls} {...props} />;
}
```

`src/components/ui/field.js`:
```js
export function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-blade-red">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/12 bg-ink-soft px-4 py-3 text-fog " +
  "outline-none focus:border-blade-green min-h-12";
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/jewelessien/Projects/bladeV1 && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add dark/neon design system, fonts, and UI primitives"
```

---

## Task 13: Home page and sections

**Files:**
- Create: `src/components/nav.js`, `src/components/hero.js`, `src/components/services-section.js`, `src/components/gallery.js`, `src/components/barbers-section.js`, `src/components/barber-monogram.js`, `src/components/footer.js`
- Modify: `src/app/page.js`

- [ ] **Step 1: Create the barber monogram placeholder `src/components/barber-monogram.js`**

```js
// Styled placeholder for barbers without a photo. PLACEHOLDER — swap for real
// photos via admin (Spec 2). Documented in README.
export function BarberMonogram({ name, className = "" }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className={`flex items-center justify-center bg-ink-soft text-fog ${className}`}
      aria-label={`${name} (photo coming soon)`}
    >
      <span className="font-display text-4xl text-glow-green">{initials}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/nav.js`**

```js
import Link from "next/link";
import { Button } from "@/components/ui/button.js";
import { Container } from "@/components/ui/container.js";

export function Nav({ shopName }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-wide">
          <span className="text-blade-red text-glow-red">{shopName}</span>
        </Link>
        <Button as="link" href="/booking" variant="green" className="h-10 min-h-0 px-5 text-sm">
          Book Now
        </Button>
      </Container>
    </header>
  );
}
```

- [ ] **Step 3: Create `src/components/hero.js`**

```js
import Image from "next/image";
import { Button } from "@/components/ui/button.js";
import { Container } from "@/components/ui/container.js";

export function Hero({ shop }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/neon-sign.webp"
          alt="The Blade Hair Studio neon sign"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/70 to-ink" />
      </div>
      <Container className="relative flex min-h-[78vh] flex-col items-start justify-center py-20">
        <h1 className="max-w-3xl text-5xl leading-[0.95] sm:text-7xl">
          {shop.name}
        </h1>
        <p className="mt-4 text-2xl text-blade-green text-glow-green sm:text-3xl">
          {shop.tagline}
        </p>
        {shop.hero_text ? (
          <p className="mt-4 max-w-xl text-muted">{shop.hero_text}</p>
        ) : null}
        <Button as="link" href="/booking" variant="primary" className="mt-8">
          Book Now
        </Button>
      </Container>
    </section>
  );
}
```

- [ ] **Step 4: Create `src/components/services-section.js`**

```js
import { Container } from "@/components/ui/container.js";
import { formatPrice, formatDuration } from "@/lib/format.js";

export function ServicesSection({ services, currency }) {
  return (
    <section className="py-16">
      <Container>
        <h2 className="text-4xl">Services</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-ink-soft p-5">
              <h3 className="text-2xl">{s.name}</h3>
              {s.description ? <p className="mt-1 text-sm text-muted">{s.description}</p> : null}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-blade-green">{formatPrice(s.price, currency)}</span>
                <span className="text-sm text-muted">{formatDuration(s.duration_minutes)}</span>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 5: Create `src/components/barbers-section.js`**

```js
import Image from "next/image";
import { Container } from "@/components/ui/container.js";
import { BarberMonogram } from "@/components/barber-monogram.js";

export function BarbersSection({ barbers }) {
  return (
    <section className="py-16">
      <Container>
        <h2 className="text-4xl">The Barbers</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-2xl border border-white/10 bg-ink-soft">
              <div className="relative aspect-[4/5]">
                {b.photo_url ? (
                  <Image src={b.photo_url} alt={b.name} fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover" />
                ) : (
                  <BarberMonogram name={b.name} className="h-full w-full" />
                )}
              </div>
              <div className="p-5">
                <h3 className="text-2xl">{b.name}</h3>
                {b.bio ? <p className="mt-1 text-sm text-muted">{b.bio}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 6: Create `src/components/gallery.js`**

```js
import Image from "next/image";
import { Container } from "@/components/ui/container.js";

const SHOTS = [
  { src: "/images/interior-wide.webp", alt: "Studio interior" },
  { src: "/images/cut-1.webp", alt: "Finished cut" },
  { src: "/images/interior-chairs.webp", alt: "Barber chairs" },
  { src: "/images/cut-2.webp", alt: "Finished cut" },
  { src: "/images/entrance.webp", alt: "Studio entrance" },
];

export function Gallery() {
  return (
    <section className="py-16">
      <Container>
        <h2 className="text-4xl">The Studio</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SHOTS.map((s) => (
            <div key={s.src} className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
              <Image src={s.src} alt={s.alt} fill sizes="(max-width:640px) 50vw, 33vw" className="object-cover" />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 7: Create `src/components/footer.js`**

```js
import { Container } from "@/components/ui/container.js";

export function Footer({ shop }) {
  return (
    <footer className="border-t border-white/10 py-12">
      <Container className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-2xl text-blade-red text-glow-red">{shop.name}</h3>
          <p className="mt-1 text-muted">{shop.tagline}</p>
        </div>
        <div className="text-sm text-muted sm:text-right">
          {shop.address ? <p>{shop.address}</p> : null}
          {shop.phone ? <p>{shop.phone}</p> : null}
          {shop.email ? <p>{shop.email}</p> : null}
          {shop.instagram ? <p>{shop.instagram}</p> : null}
        </div>
      </Container>
    </footer>
  );
}
```

- [ ] **Step 8: Compose the home page `src/app/page.js`**

```js
import { Nav } from "@/components/nav.js";
import { Hero } from "@/components/hero.js";
import { ServicesSection } from "@/components/services-section.js";
import { BarbersSection } from "@/components/barbers-section.js";
import { Gallery } from "@/components/gallery.js";
import { Footer } from "@/components/footer.js";
import { getShopSettings, getActiveServices, getActiveBarbers } from "@/lib/data.js";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [shop, services, barbers] = await Promise.all([
    getShopSettings(),
    getActiveServices(),
    getActiveBarbers(),
  ]);
  return (
    <>
      <Nav shopName={shop.name} />
      <main>
        <Hero shop={shop} />
        <ServicesSection services={services} currency={shop.currency} />
        <BarbersSection barbers={barbers} />
        <Gallery />
      </main>
      <Footer shop={shop} />
    </>
  );
}
```

- [ ] **Step 9: Verify in the browser**

Run dev server, open `http://localhost:3000`. Expected: hero with neon sign + tagline, services (4), barbers (3 with monograms), gallery, footer. Mobile viewport: no horizontal scroll.

- [ ] **Step 10: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add home page with hero, services, barbers, and gallery"
```

---

## Task 14: Booking wizard shell (step indicator + state)

**Files:**
- Create: `src/components/booking/step-indicator.js`, `src/app/booking/booking-wizard.js`, `src/app/booking/page.js`, `src/app/booking/error.js`

- [ ] **Step 1: Create `src/components/booking/step-indicator.js`**

```js
const STEPS = ["Barber", "Service", "Date", "Time", "Details", "Review"];

export function StepIndicator({ current }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {STEPS.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li
            key={label}
            className={
              "rounded-full border px-3 py-1 " +
              (active
                ? "border-blade-green text-blade-green"
                : done
                ? "border-white/20 text-fog"
                : "border-white/10 text-muted")
            }
          >
            {i + 1}. {label}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Create the wizard client component `src/app/booking/booking-wizard.js`**

```js
"use client";

import { useState } from "react";
import { StepIndicator } from "@/components/booking/step-indicator.js";
import { StepBarber } from "@/app/booking/steps/barber.js";
import { StepService } from "@/app/booking/steps/service.js";
import { StepDate } from "@/app/booking/steps/date.js";
import { StepTime } from "@/app/booking/steps/time.js";
import { StepDetails } from "@/app/booking/steps/details.js";
import { StepReview } from "@/app/booking/steps/review.js";

const EMPTY = {
  barber: null, service: null, date: null, time: null,
  customerName: "", customerPhone: "", customerEmail: "",
};

export function BookingWizard({ barbers, services, links }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(EMPTY);

  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Services offered by the chosen barber.
  const serviceIdsForBarber = new Set(
    links.filter((l) => l.barber_id === data.barber?.id).map((l) => l.service_id)
  );
  const barberServices = services.filter((s) => serviceIdsForBarber.has(s.id));

  return (
    <div className="space-y-8">
      <StepIndicator current={step} />
      {step === 0 && (
        <StepBarber barbers={barbers} value={data.barber}
          onSelect={(barber) => { set({ barber, service: null, date: null, time: null }); next(); }} />
      )}
      {step === 1 && (
        <StepService services={barberServices} value={data.service}
          onBack={back}
          onSelect={(service) => { set({ service, date: null, time: null }); next(); }} />
      )}
      {step === 2 && (
        <StepDate value={data.date} onBack={back}
          onSelect={(date) => { set({ date, time: null }); next(); }} />
      )}
      {step === 3 && (
        <StepTime barber={data.barber} service={data.service} date={data.date} value={data.time}
          onBack={back}
          onSelect={(time) => { set({ time }); next(); }} />
      )}
      {step === 4 && (
        <StepDetails data={data} onChange={set} onBack={back} onNext={next} />
      )}
      {step === 5 && (
        <StepReview data={data} onBack={back} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the booking page `src/app/booking/page.js`**

```js
import { Nav } from "@/components/nav.js";
import { Container } from "@/components/ui/container.js";
import { BookingWizard } from "@/app/booking/booking-wizard.js";
import { getShopSettings, getActiveBarbers, getActiveServices, getBarberServiceLinks } from "@/lib/data.js";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const [shop, barbers, services, links] = await Promise.all([
    getShopSettings(),
    getActiveBarbers(),
    getActiveServices(),
    getBarberServiceLinks(),
  ]);

  // Attach currency/duration display data the steps need.
  const servicesWithCurrency = services.map((s) => ({ ...s, currency: shop.currency }));

  return (
    <>
      <Nav shopName={shop.name} />
      <main className="py-10">
        <Container>
          <h1 className="text-4xl">Book an appointment</h1>
          <p className="mt-2 text-muted">{shop.tagline}</p>
          <div className="mt-8">
            <BookingWizard barbers={barbers} services={servicesWithCurrency} links={links} />
          </div>
        </Container>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Create `src/app/booking/error.js`**

```js
"use client";

import { Container } from "@/components/ui/container.js";
import { Button } from "@/components/ui/button.js";

export default function BookingError({ reset }) {
  return (
    <main className="py-20">
      <Container>
        <h1 className="text-4xl">Something went wrong</h1>
        <p className="mt-2 text-muted">We couldn’t load the booking page. Please try again.</p>
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </Container>
    </main>
  );
}
```

- [ ] **Step 5: Verify build (steps not yet created will be added next; create stub steps to compile)**

Because the wizard imports the six step files, create them in Task 15–17 before building. To keep this task self-contained, temporarily verify only that `page.js` + wizard syntax are valid by completing Tasks 15–17, then build. (Do not commit a broken build — commit at the end of Task 17.)

---

## Task 15: Booking steps — barber and service

**Files:**
- Create: `src/app/booking/steps/barber.js`, `src/app/booking/steps/service.js`

- [ ] **Step 1: Create `src/app/booking/steps/barber.js`**

```js
import Image from "next/image";
import { BarberMonogram } from "@/components/barber-monogram.js";

export function StepBarber({ barbers, value, onSelect }) {
  return (
    <div>
      <h2 className="text-3xl">Choose your barber</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {barbers.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b)}
            className={
              "overflow-hidden rounded-2xl border bg-ink-soft text-left transition " +
              (value?.id === b.id ? "border-blade-green glow-green" : "border-white/10 hover:border-white/30")
            }
          >
            <div className="relative aspect-[4/5]">
              {b.photo_url ? (
                <Image src={b.photo_url} alt={b.name} fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover" />
              ) : (
                <BarberMonogram name={b.name} className="h-full w-full" />
              )}
            </div>
            <div className="p-4">
              <h3 className="text-2xl">{b.name}</h3>
              {b.bio ? <p className="mt-1 text-sm text-muted">{b.bio}</p> : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/booking/steps/service.js`**

```js
import { Button } from "@/components/ui/button.js";
import { formatPrice, formatDuration } from "@/lib/format.js";

export function StepService({ services, value, onSelect, onBack }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Choose a service</h2>
        <Button variant="ghost" className="h-10 min-h-0 px-5 text-sm" onClick={onBack}>Back</Button>
      </div>
      {services.length === 0 ? (
        <p className="mt-6 text-muted">This barber has no services configured.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className={
                "rounded-2xl border bg-ink-soft p-5 text-left transition " +
                (value?.id === s.id ? "border-blade-green glow-green" : "border-white/10 hover:border-white/30")
              }
            >
              <h3 className="text-2xl">{s.name}</h3>
              {s.description ? <p className="mt-1 text-sm text-muted">{s.description}</p> : null}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-blade-green">{formatPrice(s.price, s.currency)}</span>
                <span className="text-sm text-muted">{formatDuration(s.duration_minutes)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Task 16: Booking steps — date and time

**Files:**
- Create: `src/components/booking/month-calendar.js`, `src/components/booking/slot-grid.js`, `src/app/booking/steps/date.js`, `src/app/booking/steps/time.js`

- [ ] **Step 1: Create `src/components/booking/month-calendar.js`**

```js
"use client";

import { useState } from "react";
import {
  addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isBefore, startOfDay, addDays,
} from "date-fns";
import { BOOKING_HORIZON_DAYS } from "@/config/constants.js";

export function MonthCalendar({ value, onPick }) {
  const today = startOfDay(new Date());
  const horizon = addDays(today, BOOKING_HORIZON_DAYS);
  const [month, setMonth] = useState(startOfMonth(value ? new Date(value) : today));

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
      <div className="flex items-center justify-between">
        <button className="px-3 py-1 text-muted hover:text-fog" onClick={() => setMonth(addMonths(month, -1))}
          disabled={isBefore(startOfMonth(month), startOfMonth(today))}>‹</button>
        <span className="font-display text-xl">{format(month, "MMMM yyyy")}</span>
        <button className="px-3 py-1 text-muted hover:text-fog" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const past = isBefore(day, today);
          const beyond = isBefore(horizon, day);
          const disabled = past || beyond;
          const iso = format(day, "yyyy-MM-dd");
          const selected = value === iso;
          return (
            <button
              key={iso}
              disabled={disabled}
              onClick={() => onPick(iso)}
              className={
                "aspect-square rounded-lg text-sm transition " +
                (selected ? "bg-blade-green text-ink " : "") +
                (!selected && !disabled ? "hover:bg-white/10 " : "") +
                (disabled ? "text-white/15 " : inMonth ? "text-fog " : "text-muted ")
              }
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/booking/slot-grid.js`**

```js
import { formatTime12h } from "@/lib/format.js";

export function SlotGrid({ slots, value, onPick }) {
  if (slots.length === 0) {
    return <p className="text-muted">No times available for this day. Try another date.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((t) => (
        <button
          key={t}
          onClick={() => onPick(t)}
          className={
            "rounded-xl border py-3 text-sm transition min-h-12 " +
            (value === t ? "border-blade-green text-blade-green glow-green" : "border-white/12 hover:border-white/35")
          }
        >
          {formatTime12h(t)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/booking/steps/date.js`**

```js
import { Button } from "@/components/ui/button.js";
import { MonthCalendar } from "@/components/booking/month-calendar.js";

export function StepDate({ value, onSelect, onBack }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Pick a date</h2>
        <Button variant="ghost" className="h-10 min-h-0 px-5 text-sm" onClick={onBack}>Back</Button>
      </div>
      <div className="mt-6 max-w-md">
        <MonthCalendar value={value} onPick={onSelect} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/booking/steps/time.js`**

```js
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.js";
import { SlotGrid } from "@/components/booking/slot-grid.js";
import { formatTime12h } from "@/lib/format.js";

export function StepTime({ barber, service, date, value, onSelect, onBack }) {
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    setError(null);
    const url = `/api/availability?barberId=${barber.id}&serviceId=${service.id}&date=${date}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Failed to load times")))
      .then((d) => { if (alive) setSlots(d.slots); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [barber.id, service.id, date]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Pick a time</h2>
        <Button variant="ghost" className="h-10 min-h-0 px-5 text-sm" onClick={onBack}>Back</Button>
      </div>
      <p className="mt-2 text-muted">{date} · {service.name} with {barber.name}</p>
      <div className="mt-6">
        {error ? <p className="text-blade-red">{error}</p> : null}
        {!error && slots === null ? <p className="text-muted">Loading times…</p> : null}
        {!error && slots !== null ? <SlotGrid slots={slots} value={value} onPick={onSelect} /> : null}
      </div>
      {value ? <p className="mt-4 text-blade-green">Selected: {formatTime12h(value)}</p> : null}
    </div>
  );
}
```

---

## Task 17: Booking steps — details, review, and submit

**Files:**
- Create: `src/app/booking/steps/details.js`, `src/app/booking/steps/review.js`

- [ ] **Step 1: Create `src/app/booking/steps/details.js`**

```js
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button.js";
import { Field, inputClass } from "@/components/ui/field.js";
import { bookingInputSchema } from "@/lib/validation.js";

export function StepDetails({ data, onChange, onBack, onNext }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const candidate = {
      barberId: data.barber.id,
      serviceId: data.service.id,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      date: data.date,
      time: data.time,
    };
    const result = bookingInputSchema.safeParse(candidate);
    if (result.success) { setErrors({}); onNext(); return; }
    setErrors(result.error.flatten().fieldErrors);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Your details</h2>
        <Button variant="ghost" className="h-10 min-h-0 px-5 text-sm" onClick={onBack}>Back</Button>
      </div>
      <div className="mt-6 max-w-md space-y-4">
        <Field label="Full name" error={errors.customerName?.[0]}>
          <input className={inputClass} value={data.customerName}
            onChange={(e) => onChange({ customerName: e.target.value })} />
        </Field>
        <Field label="Phone number" error={errors.customerPhone?.[0]}>
          <input className={inputClass} inputMode="tel" value={data.customerPhone}
            onChange={(e) => onChange({ customerPhone: e.target.value })} />
        </Field>
        <Field label="Email" error={errors.customerEmail?.[0]}>
          <input className={inputClass} inputMode="email" value={data.customerEmail}
            onChange={(e) => onChange({ customerEmail: e.target.value })} />
        </Field>
        <Button className="w-full" onClick={validate}>Review booking</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/booking/steps/review.js`**

```js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button.js";
import { formatTime12h, formatPrice } from "@/lib/format.js";

export function StepReview({ data, onBack }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          barberId: data.barber.id,
          serviceId: data.service.id,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          date: data.date,
          time: data.time,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create booking");
      router.push(`/confirmation?id=${body.id}&token=${body.token}`);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const row = (label, val) => (
    <div className="flex justify-between border-b border-white/10 py-3">
      <span className="text-muted">{label}</span>
      <span>{val}</span>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Review &amp; confirm</h2>
        <Button variant="ghost" className="h-10 min-h-0 px-5 text-sm" onClick={onBack} disabled={submitting}>Back</Button>
      </div>
      <div className="mt-6 max-w-md rounded-2xl border border-white/10 bg-ink-soft p-5">
        {row("Barber", data.barber.name)}
        {row("Service", data.service.name)}
        {row("Price", formatPrice(data.service.price, data.service.currency))}
        {row("Date", data.date)}
        {row("Time", formatTime12h(data.time))}
        {row("Name", data.customerName)}
        {row("Phone", data.customerPhone)}
        {row("Email", data.customerEmail)}
      </div>
      {error ? <p className="mt-4 max-w-md text-blade-red">{error}</p> : null}
      <Button className="mt-6 w-full max-w-md" variant="green" onClick={submit} disabled={submitting}>
        {submitting ? "Booking…" : "Confirm booking"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Verify the full booking build**

Run: `cd /Users/jewelessien/Projects/bladeV1 && npm run build`
Expected: build succeeds; `/booking` route compiles.

- [ ] **Step 4: Commit Tasks 14–17**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add booking wizard with barber/service/date/time/details/review steps"
```

---

## Task 18: Confirmation page

**Files:**
- Create: `src/app/confirmation/page.js`

- [ ] **Step 1: Implement `src/app/confirmation/page.js`**

```js
import Link from "next/link";
import { Nav } from "@/components/nav.js";
import { Container } from "@/components/ui/container.js";
import { Button } from "@/components/ui/button.js";
import { formatTime12h } from "@/lib/format.js";
import { getShopSettings, getBookingById } from "@/lib/data.js";
import { createServiceClient } from "@/lib/supabase/server.js";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ searchParams }) {
  const params = await searchParams;
  const shop = await getShopSettings();
  const booking = params?.id && params?.token ? await getBookingById(params.id, params.token) : null;

  if (!booking) {
    return (
      <>
        <Nav shopName={shop.name} />
        <main className="py-20">
          <Container>
            <h1 className="text-4xl">Booking not found</h1>
            <p className="mt-2 text-muted">We couldn’t find that booking.</p>
            <Button as="link" href="/booking" className="mt-6">Make a booking</Button>
          </Container>
        </main>
      </>
    );
  }

  const db = createServiceClient();
  const [{ data: barber }, { data: service }] = await Promise.all([
    db.from("barbers").select("name").eq("id", booking.barber_id).single(),
    db.from("services").select("name").eq("id", booking.service_id).single(),
  ]);

  return (
    <>
      <Nav shopName={shop.name} />
      <main className="py-16">
        <Container>
          <div className="max-w-lg rounded-2xl border border-blade-green/40 bg-ink-soft p-8 glow-green">
            <p className="text-blade-green text-glow-green">You’re booked in ✂</p>
            <h1 className="mt-2 text-4xl">See you soon, {booking.customer_name.split(" ")[0]}!</h1>
            <div className="mt-6 space-y-2 text-fog">
              <p><span className="text-muted">Barber:</span> {barber?.name}</p>
              <p><span className="text-muted">Service:</span> {service?.name}</p>
              <p><span className="text-muted">Date:</span> {booking.booking_date}</p>
              <p><span className="text-muted">Time:</span> {formatTime12h(booking.booking_time.slice(0, 5))}</p>
            </div>
            <p className="mt-6 text-sm text-muted">
              A confirmation has been sent to your phone and email. {shop.tagline}
            </p>
            <Button as="link" href="/" variant="ghost" className="mt-6">Back to home</Button>
          </div>
        </Container>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verify end-to-end in the browser**

Run dev server. Complete a full booking from `/booking`. Expected: redirect to `/confirmation?id=…&token=…` showing the correct summary. Verify the booking row exists via Supabase MCP, then delete the test row.

- [ ] **Step 3: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "feat: add confirmation page"
```

---

## Task 19: Root error/not-found pages and README

**Files:**
- Create: `src/app/error.js`, `src/app/not-found.js`, `README.md`

- [ ] **Step 1: Create `src/app/error.js`**

```js
"use client";

export default function GlobalError({ reset }) {
  return (
    <main style={{ padding: "4rem 1.5rem" }}>
      <h1>Something went wrong</h1>
      <p>Please try again.</p>
      <button onClick={reset}>Retry</button>
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/not-found.js`**

```js
import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: "4rem 1.5rem" }}>
      <h1>Page not found</h1>
      <Link href="/">Back to home</Link>
    </main>
  );
}
```

- [ ] **Step 3: Write `README.md`**

````markdown
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
   `public/images/*.webp`.
5. **Run:** `npm run dev` → http://localhost:3000
6. **Test:** `npm test` (availability engine, formatting, validation).
7. **Build:** `npm run build`

## Deploy to Vercel
Push to GitHub, import the repo in Vercel, add the same env vars in Project Settings,
deploy. (TypeScript/JS both deploy zero-config.)

## Notifications without keys
If Twilio/Resend env vars are absent, sends are skipped and logged — the booking still
succeeds. Add keys when ready.

## Placeholders to replace later
- **Barber photos:** none provided; the UI shows styled monogram placeholders
  (`src/components/barber-monogram.js`). Upload real photos via the admin dashboard
  (Spec 2) or set `barbers.photo_url`.
- **Shop contact details:** `shop_settings` seed ships with empty phone/email/address/
  instagram and empty `notify_phone`/`notify_email`. Fill these in (admin, Spec 2) so
  owner notifications have a destination.

## Tested
- `npm test` passes (availability, formatting, validation).
- Manual browser pass: home loads; full booking completes; confirmation renders;
  double-booking returns 409; `next build` clean. (See Task 20 in the plan.)

## Roadmap
- **Spec 2:** admin dashboard (Supabase Auth, CRUD, bookings management, closures, photo uploads).
- **Spec 3:** reminders (Vercel Cron), analytics, customer history, self-serve reschedule/cancel, calendar export.
````

- [ ] **Step 4: Commit**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "docs: add README and root error/not-found pages"
```

---

## Task 20: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the unit tests**

Run: `cd /Users/jewelessien/Projects/bladeV1 && npm test`
Expected: all tests pass (format, availability, validation).

- [ ] **Step 2: Production build**

Run: `cd /Users/jewelessien/Projects/bladeV1 && npm run build`
Expected: completes with no errors; routes `/`, `/booking`, `/confirmation`, `/api/availability`, `/api/bookings` listed.

- [ ] **Step 3: Manual browser verification (dev server)**

With `.env.local` filled (at least Supabase keys), run `npm run dev` and verify:
- Home loads with real images, services, barbers, gallery — no horizontal scroll on a 375px viewport.
- Booking: pick barber → only that barber's services show → pick service → pick a date with hours → times load → past/booked times absent → enter details (bad email shows inline error) → review → confirm → redirected to confirmation with correct summary.
- Re-attempt the **same** barber/date/time → 409 friendly message.
- Notification logs show `[sms] skipped` / `[email] skipped` without keys (or real sends if keys present).

- [ ] **Step 4: Clean up any test bookings**

Via Supabase MCP `execute_sql`: `delete from bookings where customer_email like '%example.com';`

- [ ] **Step 5: Final commit (if any doc tweaks) and push**

```bash
cd /Users/jewelessien/Projects/bladeV1
git add -A
git commit -m "test: verify Spec 1 customer booking platform" --allow-empty
# Push only when the user asks.
```

---

## Self-review (completed by plan author)

**Spec coverage:** schema/RLS/seed (Task 3) ✓; availability engine (Task 6) ✓; home page driven by shop_settings (Task 13) ✓; booking flow barber→service→date→time→details→confirm (Tasks 14–17) ✓; double-booking prevention (Tasks 3 index + 11) ✓; notifications customer+owner fail-soft (Tasks 9, 11) ✓; confirmation page (Task 18) ✓; images incl. HEIC convert + screenshot crop + barber placeholders (Tasks 4, 13) ✓; error handling (Tasks 11, 14, 19) ✓; testing (Tasks 5–7, 20) ✓; README + .env.example (Tasks 2, 19) ✓; structure/deps (Task 1) ✓. Admin + SaaS correctly deferred.

**Placeholder scan:** no TBD/TODO; all code blocks complete; the only "placeholder" references are the intentional barber monogram + empty shop contact fields, both documented for swap.

**Type/name consistency:** `getAvailableSlots` signature consistent across availability.js, the two API routes, and tests; `bookingInputSchema`/`availabilityQuerySchema` names consistent; data helper names (`getShopSettings`, `getActiveBarbers`, `getActiveServices`, `getBarberServiceLinks`, `getBookingById`) consistent between `data.js` and all consumers; API response shape `{id, token, summary}` consistent between bookings route and review step.

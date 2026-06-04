# The Blade — Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-code, password-protected admin dashboard so the owner can manage bookings, barbers, services, shop content, and closures.

**Architecture:** Supabase Auth cookie sessions via `@supabase/ssr`; a root `middleware.js` plus a per-action `requireAdmin()` gate `/admin/*`. All admin reads/writes go through a cookie-bound session client governed by the existing `authenticated`-role RLS; mutations are Next.js Server Actions validated with Zod. The service-role client stays reserved for the public booking insert. Barber photos live in a public Supabase Storage `media` bucket. The admin UI is a light theme, separate from the dark customer site.

**Tech Stack:** Next.js 15 App Router (JavaScript), `@supabase/ssr`, `@supabase/supabase-js`, Zod, Supabase Storage, `node --test`.

**Spec:** `docs/superpowers/specs/2026-06-02-blade-admin-dashboard-design.md`

**Conventions:**
- Run all commands from the repo root `/Users/jewelessien/Projects/bladeV1`.
- Branch: continue on `feat/customer-booking` (current branch) unless the executor prefers a fresh `feat/admin-dashboard` branched off it. Do not work on `main`.
- Tests: `npm test` runs `node --test 'src/**/*.test.js'`.
- Storage migration `0002` is applied to the live project via the Supabase MCP `apply_migration` tool during Task 11 (there is no local Supabase stack).
- Supabase project ref: `uvxnnurkihgkpqwjgxzw`. Env already in `.env.local`.

---

## File Structure

```
package.json                                   MODIFY  add @supabase/ssr
next.config.mjs                                MODIFY  images.remotePatterns (Supabase Storage)
src/middleware.js                              CREATE  session refresh + /admin gate (in src/ because the app uses a src dir)
scripts/create-admin.mjs                       CREATE  seed owner auth user

src/lib/supabase/ssr.js                        CREATE  createSessionClient() + requireAdmin()
src/lib/supabase/middleware-client.js          CREATE  updateSession() helper for middleware
src/lib/slug.js                                CREATE  slugify() + uniqueSlug()  (pure, tested)
src/lib/slug.test.js                           CREATE
src/lib/reschedule.js                          CREATE  otherBookings()  (pure, tested)
src/lib/reschedule.test.js                     CREATE
src/lib/admin-validation.js                    CREATE  admin Zod schemas + parseForm()
src/lib/admin-validation.test.js               CREATE
src/lib/data-admin.js                          CREATE  server-only admin read helpers
src/lib/notifications/email.js                 MODIFY  cancellation + reschedule templates
src/lib/notifications/sms.js                   MODIFY  cancellation + reschedule templates
src/lib/notifications/index.js                 MODIFY  sendCancellation/sendReschedule

src/app/admin/admin.css                        CREATE  light theme + shared classes
src/app/admin/login/page.js                    CREATE  login form (ungated)
src/app/admin/login/actions.js                 CREATE  signIn / signOut
src/app/admin/(dash)/layout.js                 CREATE  auth gate + shell + nav
src/app/admin/(dash)/page.js                   CREATE  dashboard home
src/app/admin/(dash)/shop/page.js              CREATE  shop_settings editor
src/app/admin/(dash)/shop/actions.js           CREATE
src/app/admin/(dash)/services/page.js          CREATE  services CRUD
src/app/admin/(dash)/services/actions.js       CREATE
src/app/admin/(dash)/barbers/page.js           CREATE  barbers CRUD
src/app/admin/(dash)/barbers/actions.js        CREATE
src/app/admin/(dash)/closures/page.js          CREATE  closures CRUD
src/app/admin/(dash)/closures/actions.js       CREATE
src/app/admin/(dash)/bookings/page.js          CREATE  bookings list + filters
src/app/admin/(dash)/bookings/actions.js       CREATE  complete / cancel / no-show
src/app/admin/(dash)/bookings/new/page.js      CREATE  manual booking
src/app/admin/(dash)/bookings/new/actions.js   CREATE
src/app/admin/(dash)/bookings/[id]/reschedule/page.js     CREATE
src/app/admin/(dash)/bookings/[id]/reschedule/actions.js  CREATE

src/components/admin/nav.js                     CREATE  sidebar nav + sign-out
src/components/admin/confirm-button.js          CREATE  client confirm wrapper
src/components/admin/availability-editor.js     CREATE  weekly hours editor (client)
src/components/admin/services-multiselect.js    CREATE  services-offered checkboxes (client)
src/components/admin/photo-upload-field.js       CREATE  file input + preview (client)
src/components/admin/slot-picker.js             CREATE  availability slot picker (client)

supabase/migrations/0002_admin_storage.sql      CREATE  media bucket + storage policies
```

---

## Task 1: Dependencies and image config

**Files:**
- Modify: `package.json`
- Modify: `next.config.mjs`

- [ ] **Step 1: Install `@supabase/ssr`**

Run:
```bash
npm install @supabase/ssr@^0.5.2
```
Expected: `package.json` `dependencies` now lists `@supabase/ssr`; `npm install` exits 0.

- [ ] **Step 2: Add Supabase Storage to `next.config.mjs` remotePatterns**

Replace the entire contents of `next.config.mjs` with:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uvxnnurkihgkpqwjgxzw.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 3: Verify the build still compiles**

Run:
```bash
npm run build
```
Expected: build completes with no errors (warnings about unused env are fine).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json next.config.mjs
git commit -m "chore: add @supabase/ssr and Supabase Storage image host"
```

---

## Task 2: Session client and requireAdmin gate

**Files:**
- Create: `src/lib/supabase/ssr.js`

- [ ] **Step 1: Create the session client + requireAdmin helper**

Create `src/lib/supabase/ssr.js`:
```js
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

// Cookie-bound client for Server Components and Server Actions.
// Subject to RLS as the logged-in (authenticated) user.
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          // In Server Components cookies are read-only; ignore writes there.
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* called from a Server Component render — safe to ignore */
          }
        },
      },
    }
  );
}

// Use at the top of every protected page and every admin Server Action.
// Returns { supabase, user }; redirects to /admin/login if not authenticated.
export async function requireAdmin() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return { supabase, user };
}
```

- [ ] **Step 2: Verify it imports cleanly**

Run:
```bash
node --input-type=module -e "import('@supabase/ssr').then(m=>console.log(typeof m.createServerClient))"
```
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/ssr.js
git commit -m "feat: add cookie-bound session client and requireAdmin gate"
```

---

## Task 3: Middleware session gate

**Files:**
- Create: `src/lib/supabase/middleware-client.js`
- Create: `middleware.js`

- [ ] **Step 1: Create the middleware session updater**

Create `src/lib/supabase/middleware-client.js`:
```js
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Refreshes the Supabase session cookie and enforces the /admin gate.
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/admin/login";

  if (isAdmin && !isLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 2: Create `src/middleware.js`**

This project uses a `src/` directory, so Next.js only loads middleware from `src/middleware.js` — NOT the repo root. Create `src/middleware.js`:
```js
import { updateSession } from "@/lib/supabase/middleware-client";

export async function middleware(request) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 3: Verify build compiles (middleware is type-checked at build)**

Run:
```bash
npm run build
```
Expected: build succeeds; output mentions `ƒ Middleware`.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.js src/lib/supabase/middleware-client.js
git commit -m "feat: gate /admin/* behind Supabase session in middleware"
```

---

## Task 4: Seed the owner account

**Files:**
- Create: `scripts/create-admin.mjs`

- [ ] **Step 1: Create the admin-seeding script**

Create `scripts/create-admin.mjs`:
```js
// Seed the owner admin user via the Supabase Auth admin API.
// Run: node --env-file=.env.local scripts/create-admin.mjs
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const rl = createInterface({ input, output });
const email =
  (await rl.question("Admin email [essienjewel@gmail.com]: ")).trim() ||
  "essienjewel@gmail.com";
const password = (await rl.question("Password (min 8 chars): ")).trim();
rl.close();

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password, email_confirm: true }),
});

const body = await res.json();
if (!res.ok) {
  console.error("Failed to create admin:", body);
  process.exit(1);
}
console.log("Created admin user:", body.email ?? body.id);
```

- [ ] **Step 2: Run it to create the owner account**

Run:
```bash
node --env-file=.env.local scripts/create-admin.mjs
```
At the prompts: accept the default email, enter a password you choose.
Expected: prints `Created admin user: essienjewel@gmail.com`.
(If it prints a "User already registered" error, the account already exists — that is fine.)

- [ ] **Step 3: Commit (the script only; never commit the password)**

```bash
git add scripts/create-admin.mjs
git commit -m "feat: add owner admin seeding script"
```

---

## Task 5: Login page and auth actions

**Files:**
- Create: `src/app/admin/admin.css`
- Create: `src/app/admin/login/actions.js`
- Create: `src/app/admin/login/page.js`

- [ ] **Step 1: Create the admin light theme stylesheet**

Create `src/app/admin/admin.css`:
```css
.admin-shell {
  min-height: 100vh;
  background: #f5f6f8;
  color: #14161a;
  font-family: var(--font-inter, system-ui, sans-serif);
  display: grid;
  grid-template-columns: 220px 1fr;
}
.admin-main {
  padding: 1.5rem 2rem;
  max-width: 1100px;
}
.admin-login {
  min-height: 100vh;
  background: #f5f6f8;
  color: #14161a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-inter, system-ui, sans-serif);
}
.admin-card {
  background: #fff;
  border: 1px solid #e3e6ea;
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
}
.admin-h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem; }
.admin-h2 { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.75rem; }
.admin-label { display: block; font-size: 0.85rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
.admin-input, .admin-select, .admin-textarea {
  width: 100%; padding: 0.5rem 0.65rem; border: 1px solid #cfd4da;
  border-radius: 7px; background: #fff; color: #14161a; font-size: 0.95rem;
}
.admin-textarea { min-height: 70px; resize: vertical; }
.admin-btn {
  display: inline-block; padding: 0.5rem 0.9rem; border-radius: 7px; border: none;
  background: #14161a; color: #fff; font-weight: 600; cursor: pointer; font-size: 0.9rem;
}
.admin-btn:disabled { opacity: 0.5; cursor: default; }
.admin-btn-secondary { background: #e3e6ea; color: #14161a; }
.admin-btn-danger { background: #c8323a; color: #fff; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.admin-table th, .admin-table td {
  text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid #eceef1;
}
.admin-table th { font-weight: 600; color: #555; }
.field-error { color: #c8323a; font-size: 0.8rem; margin-top: 0.25rem; }
.form-error { color: #c8323a; font-size: 0.9rem; margin: 0.5rem 0; }
.form-ok { color: #3db960; font-size: 0.9rem; margin: 0.5rem 0; }
.admin-nav { background: #14161a; color: #fff; padding: 1.25rem 1rem; }
.admin-nav a { display: block; color: #cfd4da; text-decoration: none; padding: 0.5rem 0.6rem; border-radius: 6px; font-size: 0.92rem; }
.admin-nav a:hover { background: #23262c; color: #fff; }
.admin-nav .brand { color: #fff; font-weight: 700; margin-bottom: 1rem; font-size: 1.05rem; }
.muted { color: #6b7178; }
.badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.badge-confirmed { background: #e6f4ea; color: #1f7a3d; }
.badge-completed { background: #e6edf7; color: #2b5797; }
.badge-cancelled { background: #fbe7e8; color: #b3262d; }
.badge-no_show { background: #f3e8d0; color: #8a6d1f; }
.row-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
```

- [ ] **Step 2: Create the auth actions**

Create `src/app/admin/login/actions.js`:
```js
"use server";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/ssr";

export async function signIn(prevState, formData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Invalid email or password." };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
```

- [ ] **Step 3: Create the login page**

Create `src/app/admin/login/page.js`:
```js
"use client";
import { useActionState } from "react";
import { signIn } from "./actions";
import "../admin.css";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, {});
  return (
    <div className="admin-login">
      <form action={formAction} className="admin-card" style={{ width: 340 }}>
        <h1 className="admin-h1">The Blade — Admin</h1>
        <label className="admin-label" htmlFor="email">Email</label>
        <input className="admin-input" id="email" name="email" type="email" autoComplete="username" required />
        <label className="admin-label" htmlFor="password">Password</label>
        <input className="admin-input" id="password" name="password" type="password" autoComplete="current-password" required />
        {state?.error ? <p className="form-error">{state.error}</p> : null}
        <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "1rem", width: "100%" }}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Build to confirm the route compiles**

Run:
```bash
npm run build
```
Expected: build succeeds; route list includes `/admin/login`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/admin.css src/app/admin/login
git commit -m "feat: admin login page, auth actions, light theme"
```

---

## Task 6: Dashboard shell, nav, and gated layout

**Files:**
- Create: `src/components/admin/nav.js`
- Create: `src/app/admin/(dash)/layout.js`
- Create: `src/app/admin/(dash)/page.js`

- [ ] **Step 1: Create the sidebar nav (with sign-out)**

Create `src/components/admin/nav.js`:
```js
import Link from "next/link";
import { signOut } from "@/app/admin/login/actions";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/barbers", label: "Barbers" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/closures", label: "Closures" },
  { href: "/admin/shop", label: "Shop content" },
];

export default function AdminNav() {
  return (
    <nav className="admin-nav">
      <div className="brand">The Blade</div>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href}>{l.label}</Link>
      ))}
      <form action={signOut} style={{ marginTop: "1.5rem" }}>
        <button className="admin-btn admin-btn-secondary" type="submit" style={{ width: "100%" }}>
          Sign out
        </button>
      </form>
    </nav>
  );
}
```

- [ ] **Step 2: Create the gated dashboard layout**

Create `src/app/admin/(dash)/layout.js`:
```js
import { requireAdmin } from "@/lib/supabase/ssr";
import AdminNav from "@/components/admin/nav";
import "../admin.css";

export const metadata = { title: "The Blade — Admin" };

export default async function DashLayout({ children }) {
  await requireAdmin();
  return (
    <div className="admin-shell">
      <AdminNav />
      <main className="admin-main">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create a minimal dashboard home (replaced fully in Task 19)**

Create `src/app/admin/(dash)/page.js`:
```js
import { requireAdmin } from "@/lib/supabase/ssr";

export default async function DashboardHome() {
  const { user } = await requireAdmin();
  return (
    <>
      <h1 className="admin-h1">Dashboard</h1>
      <p className="muted">Signed in as {user.email}.</p>
    </>
  );
}
```

- [ ] **Step 4: Manual verification — the auth gate works end to end**

Run `npm run dev`, then:
1. Visit `http://localhost:3000/admin` while logged out → you are redirected to `/admin/login`.
2. Sign in with the owner credentials from Task 4 → you land on `/admin` showing "Signed in as essienjewel@gmail.com".
3. Click "Sign out" → redirected back to `/admin/login`.
4. Visit `http://localhost:3000/admin/bookings` while logged out → redirected to `/admin/login`.

Expected: all four behaviors hold. Stop `npm run dev` when done.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/nav.js "src/app/admin/(dash)/layout.js" "src/app/admin/(dash)/page.js"
git commit -m "feat: gated admin dashboard shell with sidebar nav"
```

---

## Task 7: Shop content editor

**Files:**
- Create: `src/lib/admin-validation.js`
- Create: `src/lib/admin-validation.test.js`
- Create: `src/lib/data-admin.js`
- Create: `src/app/admin/(dash)/shop/actions.js`
- Create: `src/app/admin/(dash)/shop/page.js`

- [ ] **Step 1: Write the failing test for the shop schema**

Create `src/lib/admin-validation.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { shopSchema } from "./admin-validation.js";

test("shopSchema accepts a valid shop settings payload", () => {
  const parsed = shopSchema.parse({
    name: "The Blade",
    tagline: "Sharp cuts.",
    hero_text: "Precision cuts",
    hero_subtext: "Book now",
    phone: "",
    email: "",
    address: "",
    instagram: "",
    currency: "GBP",
    timezone: "Europe/London",
    notify_phone: "",
    notify_email: "",
  });
  assert.equal(parsed.name, "The Blade");
  assert.equal(parsed.currency, "GBP");
});

test("shopSchema rejects empty name", () => {
  assert.throws(() =>
    shopSchema.parse({ name: "", tagline: "x", currency: "GBP", timezone: "Europe/London" })
  );
});

test("shopSchema rejects bad email when provided", () => {
  assert.throws(() =>
    shopSchema.parse({ name: "x", tagline: "y", email: "not-an-email", currency: "GBP", timezone: "Europe/London" })
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — cannot find `shopSchema` in `./admin-validation.js`.

- [ ] **Step 3: Create the admin-validation module with the shop schema + form helper**

Create `src/lib/admin-validation.js`:
```js
import { z } from "zod";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

// Optional text: empty string allowed, trimmed.
const optText = z.string().trim().max(500).optional().default("");
// Optional email: empty string OR a valid email.
const optEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email")
  .optional()
  .default("");

export const shopSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  tagline: z.string().trim().min(1, "Tagline is required").max(200),
  hero_text: optText,
  hero_subtext: optText,
  phone: optText,
  email: optEmail,
  address: optText,
  instagram: optText,
  currency: z.string().trim().min(1).max(8),
  timezone: z.string().trim().min(1).max(64),
  notify_phone: optText,
  notify_email: optEmail,
});

// Convert FormData to a plain object (all values as strings).
export function formToObject(formData) {
  const obj = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

// Validate; return { data } or { fieldErrors } (flattened from Zod).
export function safeValidate(schema, obj) {
  const result = schema.safeParse(obj);
  if (result.success) return { data: result.data };
  return { fieldErrors: result.error.flatten().fieldErrors };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — the three `shopSchema` tests pass alongside the existing suite.

- [ ] **Step 5: Create the admin read helpers (shop only for now)**

Create `src/lib/data-admin.js`:
```js
import "server-only";

// All helpers take an authenticated session client (from requireAdmin()).

export async function getShopSettings(supabase) {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 6: Create the shop update action**

Create `src/app/admin/(dash)/shop/actions.js`:
```js
"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { shopSchema, formToObject, safeValidate } from "@/lib/admin-validation";

export async function updateShop(prevState, formData) {
  const { supabase } = await requireAdmin();
  const { data, fieldErrors } = safeValidate(shopSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("shop_settings")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/admin/shop");
  revalidatePath("/");
  revalidatePath("/booking");
  return { ok: true };
}
```

- [ ] **Step 7: Create the shop editor page**

Create `src/app/admin/(dash)/shop/page.js`:
```js
import { requireAdmin } from "@/lib/supabase/ssr";
import { getShopSettings } from "@/lib/data-admin";
import ShopForm from "./shop-form";

export default async function ShopPage() {
  const { supabase } = await requireAdmin();
  const shop = await getShopSettings(supabase);
  return (
    <>
      <h1 className="admin-h1">Shop content</h1>
      <ShopForm shop={shop} />
    </>
  );
}
```

- [ ] **Step 8: Create the shop form client component**

Create `src/app/admin/(dash)/shop/shop-form.js`:
```js
"use client";
import { useActionState } from "react";
import { updateShop } from "./actions";

const FIELDS = [
  ["name", "Name", "text"],
  ["tagline", "Tagline", "text"],
  ["hero_text", "Hero heading", "text"],
  ["hero_subtext", "Hero subtext", "text"],
  ["phone", "Public phone", "text"],
  ["email", "Public email", "text"],
  ["address", "Address", "text"],
  ["instagram", "Instagram handle", "text"],
  ["currency", "Currency code", "text"],
  ["timezone", "Timezone (IANA)", "text"],
  ["notify_phone", "Owner notify phone", "text"],
  ["notify_email", "Owner notify email", "text"],
];

export default function ShopForm({ shop }) {
  const [state, formAction, pending] = useActionState(updateShop, {});
  const err = state?.fieldErrors || {};
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 520 }}>
      {FIELDS.map(([name, label, type]) => (
        <div key={name}>
          <label className="admin-label" htmlFor={name}>{label}</label>
          <input
            className="admin-input"
            id={name}
            name={name}
            type={type}
            defaultValue={shop[name] ?? ""}
          />
          {err[name]?.[0] ? <p className="field-error">{err[name][0]}</p> : null}
        </div>
      ))}
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      {state?.ok ? <p className="form-ok">Saved.</p> : null}
      <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "1rem" }}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
```

- [ ] **Step 9: Manual verification**

Run `npm run dev`, sign in, go to `/admin/shop`. Change the tagline, click Save → "Saved." appears. Open `/` in another tab and reload → the new tagline shows on the homepage. Restore the tagline if you wish. Stop `npm run dev`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/admin-validation.js src/lib/admin-validation.test.js src/lib/data-admin.js "src/app/admin/(dash)/shop"
git commit -m "feat: shop content editor with validated server action"
```

---

## Task 8: Services CRUD

**Files:**
- Modify: `src/lib/admin-validation.js`
- Modify: `src/lib/admin-validation.test.js`
- Modify: `src/lib/data-admin.js`
- Create: `src/app/admin/(dash)/services/actions.js`
- Create: `src/app/admin/(dash)/services/page.js`
- Create: `src/app/admin/(dash)/services/service-form.js`

- [ ] **Step 1: Write the failing test for the service schema**

Add to `src/lib/admin-validation.test.js`:
```js
import { serviceSchema } from "./admin-validation.js";

test("serviceSchema coerces numeric strings", () => {
  const parsed = serviceSchema.parse({
    name: "Haircut",
    description: "Cut",
    duration_minutes: "30",
    price: "18.00",
    sort_order: "1",
    active: "on",
  });
  assert.equal(parsed.duration_minutes, 30);
  assert.equal(parsed.price, 18);
  assert.equal(parsed.active, true);
});

test("serviceSchema rejects zero duration", () => {
  assert.throws(() =>
    serviceSchema.parse({ name: "x", duration_minutes: "0", price: "5" })
  );
});

test("serviceSchema treats missing checkbox as inactive", () => {
  const parsed = serviceSchema.parse({ name: "x", duration_minutes: "15", price: "5" });
  assert.equal(parsed.active, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `serviceSchema` is not exported.

- [ ] **Step 3: Add the service schema + checkbox/number helpers**

Add to `src/lib/admin-validation.js` (after the imports, near the other reusable pieces):
```js
// Checkbox: HTML sends "on" when checked, nothing when not.
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const intFromString = z.coerce.number().int();
const numFromString = z.coerce.number();
```
Then add the exported schema:
```js
export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optText,
  duration_minutes: intFromString.refine((n) => n > 0, "Duration must be greater than 0"),
  price: numFromString.refine((n) => n >= 0, "Price cannot be negative"),
  sort_order: intFromString.refine((n) => n >= 0, "Sort order cannot be negative").default(0),
  active: checkbox.default(false),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — all service tests pass.

- [ ] **Step 5: Add service read helpers to `data-admin.js`**

Add to `src/lib/data-admin.js`:
```js
export async function listServices(supabase) {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 6: Create the services actions**

Create `src/app/admin/(dash)/services/actions.js`:
```js
"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { serviceSchema, formToObject, safeValidate } from "@/lib/admin-validation";

function revalidate() {
  revalidatePath("/admin/services");
  revalidatePath("/");
  revalidatePath("/booking");
}

export async function saveService(prevState, formData) {
  const { supabase } = await requireAdmin();
  const id = formData.get("id"); // empty string for new
  const { data, fieldErrors } = safeValidate(serviceSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };

  let error;
  if (id) {
    ({ error } = await supabase.from("services").update(data).eq("id", id));
  } else {
    ({ error } = await supabase.from("services").insert(data));
  }
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

export async function setServiceActive(id, active) {
  const { supabase } = await requireAdmin();
  await supabase.from("services").update({ active }).eq("id", id);
  revalidate();
}
```

- [ ] **Step 7: Create the services page**

Create `src/app/admin/(dash)/services/page.js`:
```js
import { requireAdmin } from "@/lib/supabase/ssr";
import { listServices } from "@/lib/data-admin";
import ServiceForm from "./service-form";
import ConfirmButton from "@/components/admin/confirm-button";
import { setServiceActive } from "./actions";

export default async function ServicesPage() {
  const { supabase } = await requireAdmin();
  const services = await listServices(supabase);
  return (
    <>
      <h1 className="admin-h1">Services</h1>
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Duration</th><th>Price</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.duration_minutes} min</td>
                <td>{Number(s.price).toFixed(2)}</td>
                <td>{s.active ? "Active" : "Inactive"}</td>
                <td className="row-actions">
                  <ServiceForm service={s} trigger="Edit" />
                  <ConfirmButton
                    action={setServiceActive.bind(null, s.id, !s.active)}
                    label={s.active ? "Deactivate" : "Activate"}
                    confirm={s.active ? "Deactivate this service?" : null}
                    danger={s.active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="admin-h2">Add a service</h2>
      <ServiceForm service={null} trigger="Add service" />
    </>
  );
}
```

- [ ] **Step 8: Create the confirm-button component**

Create `src/components/admin/confirm-button.js`:
```js
"use client";

// Renders a submit button inside a form bound to a server action.
// If `confirm` is set, asks for confirmation before submitting.
export default function ConfirmButton({ action, label, confirm = null, danger = false }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      style={{ display: "inline" }}
    >
      <button className={`admin-btn ${danger ? "admin-btn-danger" : "admin-btn-secondary"}`} type="submit">
        {label}
      </button>
    </form>
  );
}
```

- [ ] **Step 9: Create the service form (collapsible edit/add)**

Create `src/app/admin/(dash)/services/service-form.js`:
```js
"use client";
import { useState } from "react";
import { useActionState } from "react";
import { saveService } from "./actions";

export default function ServiceForm({ service, trigger }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveService, {});
  const err = state?.fieldErrors || {};
  if (state?.ok && open) setTimeout(() => setOpen(false), 300);

  if (!open) {
    return (
      <button className="admin-btn admin-btn-secondary" onClick={() => setOpen(true)}>
        {trigger}
      </button>
    );
  }
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 420 }}>
      <input type="hidden" name="id" defaultValue={service?.id ?? ""} />
      <label className="admin-label">Name</label>
      <input className="admin-input" name="name" defaultValue={service?.name ?? ""} />
      {err.name?.[0] && <p className="field-error">{err.name[0]}</p>}

      <label className="admin-label">Description</label>
      <input className="admin-input" name="description" defaultValue={service?.description ?? ""} />

      <label className="admin-label">Duration (minutes)</label>
      <input className="admin-input" name="duration_minutes" type="number" defaultValue={service?.duration_minutes ?? 30} />
      {err.duration_minutes?.[0] && <p className="field-error">{err.duration_minutes[0]}</p>}

      <label className="admin-label">Price</label>
      <input className="admin-input" name="price" type="number" step="0.01" defaultValue={service?.price ?? 0} />
      {err.price?.[0] && <p className="field-error">{err.price[0]}</p>}

      <label className="admin-label">Sort order</label>
      <input className="admin-input" name="sort_order" type="number" defaultValue={service?.sort_order ?? 0} />

      <label className="admin-label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input name="active" type="checkbox" defaultChecked={service ? service.active : true} /> Active
      </label>

      {state?.error && <p className="form-error">{state.error}</p>}
      <div className="row-actions" style={{ marginTop: "0.75rem" }}>
        <button className="admin-btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button className="admin-btn admin-btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 10: Manual verification**

Run `npm run dev`, sign in, go to `/admin/services`. Add a service ("Hot Towel Shave", 20 min, 12). It appears in the table and on `/booking` (after picking a barber that offers it — note new services aren't linked to barbers yet; that link is set in Task 12's barber form). Edit a service's price → reflected on `/`. Deactivate a service → it disappears from the public site. Stop `npm run dev`.

- [ ] **Step 11: Commit**

```bash
git add src/lib/admin-validation.js src/lib/admin-validation.test.js src/lib/data-admin.js "src/app/admin/(dash)/services" src/components/admin/confirm-button.js
git commit -m "feat: services CRUD with activate/deactivate"
```

---

## Task 9: Slug helper

**Files:**
- Create: `src/lib/slug.js`
- Create: `src/lib/slug.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/slug.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug } from "./slug.js";

test("slugify lowercases and hyphenates", () => {
  assert.equal(slugify("Andre The Barber!"), "andre-the-barber");
});

test("slugify trims leading/trailing separators", () => {
  assert.equal(slugify("  --Marcus--  "), "marcus");
});

test("uniqueSlug returns base when unused", () => {
  assert.equal(uniqueSlug("andre", ["marcus", "deon"]), "andre");
});

test("uniqueSlug appends a counter on collision", () => {
  assert.equal(uniqueSlug("andre", ["andre", "andre-2"]), "andre-3");
});

test("uniqueSlug falls back when base is empty", () => {
  assert.equal(uniqueSlug("", []), "barber");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `./slug.js` not found.

- [ ] **Step 3: Implement the slug helpers**

Create `src/lib/slug.js`:
```js
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueSlug(base, existing) {
  const taken = new Set(existing);
  const root = base || "barber";
  if (!taken.has(root)) return root;
  let i = 2;
  while (taken.has(`${root}-${i}`)) i += 1;
  return `${root}-${i}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — all five slug tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.js src/lib/slug.test.js
git commit -m "feat: slugify and uniqueSlug helpers"
```

---

## Task 10: Barber and availability schemas

**Files:**
- Modify: `src/lib/admin-validation.js`
- Modify: `src/lib/admin-validation.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/admin-validation.test.js`:
```js
import { barberSchema, availabilitySchema } from "./admin-validation.js";

test("availabilitySchema accepts a weekly object with one range per day", () => {
  const parsed = availabilitySchema.parse({
    mon: [{ start: "09:00", end: "17:00" }],
    tue: [],
    wed: [{ start: "10:00", end: "18:00" }],
    thu: [], fri: [], sat: [], sun: [],
  });
  assert.equal(parsed.mon[0].end, "17:00");
});

test("availabilitySchema rejects end before start", () => {
  assert.throws(() =>
    availabilitySchema.parse({
      mon: [{ start: "17:00", end: "09:00" }],
      tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    })
  );
});

test("barberSchema parses serviceIds and active checkbox", () => {
  const parsed = barberSchema.parse({
    name: "Andre",
    bio: "",
    phone: "",
    email: "",
    sort_order: "3",
    active: "on",
    serviceIds: ["11111111-1111-1111-1111-111111111111"],
  });
  assert.equal(parsed.name, "Andre");
  assert.equal(parsed.serviceIds.length, 1);
  assert.equal(parsed.active, true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `barberSchema` / `availabilitySchema` not exported.

- [ ] **Step 3: Implement the schemas**

Add to `src/lib/admin-validation.js`:
```js
const rangeSchema = z
  .object({ start: z.string().regex(timeRe, "Invalid time"), end: z.string().regex(timeRe, "Invalid time") })
  .refine((r) => r.start < r.end, "End must be after start");

const dayList = z.array(rangeSchema).default([]);

export const availabilitySchema = z.object({
  sun: dayList, mon: dayList, tue: dayList, wed: dayList, thu: dayList, fri: dayList, sat: dayList,
});

export const barberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  bio: optText,
  phone: optText,
  email: optEmail,
  sort_order: intFromString.refine((n) => n >= 0, "Sort order cannot be negative").default(0),
  active: checkbox.default(false),
  serviceIds: z.array(z.string().uuid()).default([]),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — barber and availability tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-validation.js src/lib/admin-validation.test.js
git commit -m "feat: barber and weekly-availability Zod schemas"
```

---

## Task 11: Storage bucket and photo upload

**Files:**
- Create: `supabase/migrations/0002_admin_storage.sql`
- Create: `src/components/admin/photo-upload-field.js`

- [ ] **Step 1: Write the storage migration**

Create `supabase/migrations/0002_admin_storage.sql`:
```sql
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
```

- [ ] **Step 2: Apply the migration to the live project**

Use the Supabase MCP `apply_migration` tool with name `0002_admin_storage` and the SQL above (project ref `uvxnnurkihgkpqwjgxzw`). If the MCP is unavailable, paste the SQL into the Supabase SQL Editor and run it.
Expected: success. Verify with the MCP `list_tables`/SQL: `select id, public from storage.buckets where id='media';` returns one public row.

- [ ] **Step 3: Create the photo upload field (client preview)**

Create `src/components/admin/photo-upload-field.js`:
```js
"use client";
import { useState } from "react";

export default function PhotoUploadField({ currentUrl }) {
  const [preview, setPreview] = useState(currentUrl || null);
  return (
    <div>
      <label className="admin-label">Photo (JPEG/PNG/WebP, ≤ 3 MB)</label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
      ) : null}
      <input
        className="admin-input"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPreview(URL.createObjectURL(f));
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_admin_storage.sql src/components/admin/photo-upload-field.js
git commit -m "feat: media storage bucket, policies, and photo upload field"
```

---

## Task 12: Barbers CRUD (photo, availability, services)

**Files:**
- Modify: `src/lib/data-admin.js`
- Create: `src/components/admin/availability-editor.js`
- Create: `src/components/admin/services-multiselect.js`
- Create: `src/app/admin/(dash)/barbers/actions.js`
- Create: `src/app/admin/(dash)/barbers/page.js`
- Create: `src/app/admin/(dash)/barbers/barber-form.js`

- [ ] **Step 1: Add barber read helpers**

Add to `src/lib/data-admin.js`:
```js
export async function listBarbers(supabase) {
  const { data, error } = await supabase
    .from("barbers")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listBarberServiceIds(supabase, barberId) {
  const { data, error } = await supabase
    .from("barber_services")
    .select("service_id")
    .eq("barber_id", barberId);
  if (error) throw error;
  return data.map((r) => r.service_id);
}

export async function listAllSlugs(supabase) {
  const { data, error } = await supabase.from("barbers").select("slug");
  if (error) throw error;
  return data.map((r) => r.slug);
}
```

- [ ] **Step 2: Create the availability editor (client)**

Create `src/components/admin/availability-editor.js`:
```js
"use client";
import { useState } from "react";

const DAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"],
  ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

// Serializes a weekly availability object into a hidden JSON input named "availability".
export default function AvailabilityEditor({ value }) {
  const init = {};
  for (const [key] of DAYS) {
    const ranges = value?.[key] ?? [];
    const first = ranges[0] || null;
    init[key] = { open: ranges.length > 0, start: first?.start ?? "09:00", end: first?.end ?? "17:00" };
  }
  const [days, setDays] = useState(init);

  const json = {};
  for (const [key] of DAYS) {
    json[key] = days[key].open ? [{ start: days[key].start, end: days[key].end }] : [];
  }

  function update(key, patch) {
    setDays((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  }

  return (
    <div>
      <label className="admin-label">Weekly availability</label>
      <input type="hidden" name="availability" value={JSON.stringify(json)} readOnly />
      <table className="admin-table">
        <tbody>
          {DAYS.map(([key, label]) => (
            <tr key={key}>
              <td style={{ width: 110 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={days[key].open} onChange={(e) => update(key, { open: e.target.checked })} />
                  {label}
                </label>
              </td>
              <td>
                <input className="admin-input" type="time" value={days[key].start} disabled={!days[key].open} onChange={(e) => update(key, { start: e.target.value })} style={{ width: 130 }} />
              </td>
              <td>
                <input className="admin-input" type="time" value={days[key].end} disabled={!days[key].open} onChange={(e) => update(key, { end: e.target.value })} style={{ width: 130 }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create the services multiselect (client)**

Create `src/components/admin/services-multiselect.js`:
```js
"use client";

// Renders a checkbox per service; checked ones submit as repeated name="serviceIds".
export default function ServicesMultiselect({ services, selectedIds }) {
  const selected = new Set(selectedIds || []);
  return (
    <div>
      <label className="admin-label">Services offered</label>
      {services.map((s) => (
        <label key={s.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={selected.has(s.id)} />
          {s.name}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create the barbers actions**

Create `src/app/admin/(dash)/barbers/actions.js`:
```js
"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { barberSchema, availabilitySchema, formToObject, safeValidate } from "@/lib/admin-validation";
import { slugify, uniqueSlug } from "@/lib/slug";
import { listAllSlugs, listBarberServiceIds } from "@/lib/data-admin";

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

function revalidate() {
  revalidatePath("/admin/barbers");
  revalidatePath("/");
  revalidatePath("/booking");
}

async function syncServices(supabase, barberId, serviceIds) {
  const existing = await listBarberServiceIds(supabase, barberId);
  const want = new Set(serviceIds);
  const have = new Set(existing);
  const toAdd = serviceIds.filter((id) => !have.has(id));
  const toRemove = existing.filter((id) => !want.has(id));
  if (toAdd.length) {
    await supabase.from("barber_services").insert(toAdd.map((service_id) => ({ barber_id: barberId, service_id })));
  }
  for (const service_id of toRemove) {
    await supabase.from("barber_services").delete().eq("barber_id", barberId).eq("service_id", service_id);
  }
}

async function uploadPhoto(supabase, barberId, file) {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (!TYPES.includes(file.type)) return { error: "Photo must be JPEG, PNG, or WebP." };
  if (file.size > MAX_BYTES) return { error: "Photo must be 3 MB or smaller." };
  const ext = file.type.split("/")[1];
  const path = `barbers/${barberId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function saveBarber(prevState, formData) {
  const { supabase } = await requireAdmin();
  const obj = formToObject(formData);
  obj.serviceIds = formData.getAll("serviceIds");
  const { data, fieldErrors } = safeValidate(barberSchema, obj);
  if (fieldErrors) return { fieldErrors };

  // Availability comes as a JSON string from the editor.
  let availability;
  try {
    availability = availabilitySchema.parse(JSON.parse(formData.get("availability") || "{}"));
  } catch (e) {
    return { error: "Invalid availability." };
  }

  const id = formData.get("id");
  const row = {
    name: data.name,
    bio: data.bio,
    phone: data.phone,
    email: data.email,
    sort_order: data.sort_order,
    active: data.active,
    availability,
  };

  let barberId = id || null;
  if (id) {
    const { error } = await supabase.from("barbers").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const slugs = await listAllSlugs(supabase);
    row.slug = uniqueSlug(slugify(data.name), slugs);
    const { data: inserted, error } = await supabase.from("barbers").insert(row).select("id").single();
    if (error) return { error: error.message };
    barberId = inserted.id;
  }

  const photoResult = await uploadPhoto(supabase, barberId, formData.get("photo"));
  if (photoResult?.error) return { error: photoResult.error };
  if (photoResult?.url) {
    await supabase.from("barbers").update({ photo_url: photoResult.url }).eq("id", barberId);
  }

  await syncServices(supabase, barberId, data.serviceIds);
  revalidate();
  return { ok: true };
}

export async function setBarberActive(id, active) {
  const { supabase } = await requireAdmin();
  await supabase.from("barbers").update({ active }).eq("id", id);
  revalidate();
}
```

- [ ] **Step 5: Create the barbers page**

Create `src/app/admin/(dash)/barbers/page.js`:
```js
import { requireAdmin } from "@/lib/supabase/ssr";
import { listBarbers, listServices, listBarberServiceIds } from "@/lib/data-admin";
import BarberForm from "./barber-form";
import ConfirmButton from "@/components/admin/confirm-button";
import { setBarberActive } from "./actions";

export default async function BarbersPage() {
  const { supabase } = await requireAdmin();
  const [barbers, services] = await Promise.all([listBarbers(supabase), listServices(supabase)]);
  const serviceIdsByBarber = {};
  for (const b of barbers) {
    serviceIdsByBarber[b.id] = await listBarberServiceIds(supabase, b.id);
  }
  return (
    <>
      <h1 className="admin-h1">Barbers</h1>
      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Slug</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {barbers.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td className="muted">{b.slug}</td>
                <td>{b.active ? "Active" : "Inactive"}</td>
                <td className="row-actions">
                  <BarberForm barber={b} services={services} selectedIds={serviceIdsByBarber[b.id]} trigger="Edit" />
                  <ConfirmButton
                    action={setBarberActive.bind(null, b.id, !b.active)}
                    label={b.active ? "Deactivate" : "Activate"}
                    confirm={b.active ? "Deactivate this barber?" : null}
                    danger={b.active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="admin-h2">Add a barber</h2>
      <BarberForm barber={null} services={services} selectedIds={[]} trigger="Add barber" />
    </>
  );
}
```

- [ ] **Step 6: Create the barber form**

Create `src/app/admin/(dash)/barbers/barber-form.js`:
```js
"use client";
import { useState } from "react";
import { useActionState } from "react";
import { saveBarber } from "./actions";
import AvailabilityEditor from "@/components/admin/availability-editor";
import ServicesMultiselect from "@/components/admin/services-multiselect";
import PhotoUploadField from "@/components/admin/photo-upload-field";

export default function BarberForm({ barber, services, selectedIds, trigger }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveBarber, {});
  const err = state?.fieldErrors || {};
  if (state?.ok && open) setTimeout(() => setOpen(false), 300);

  if (!open) {
    return <button className="admin-btn admin-btn-secondary" onClick={() => setOpen(true)}>{trigger}</button>;
  }
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 520 }}>
      <input type="hidden" name="id" defaultValue={barber?.id ?? ""} />

      <label className="admin-label">Name</label>
      <input className="admin-input" name="name" defaultValue={barber?.name ?? ""} />
      {err.name?.[0] && <p className="field-error">{err.name[0]}</p>}

      <label className="admin-label">Bio</label>
      <textarea className="admin-textarea" name="bio" defaultValue={barber?.bio ?? ""} />

      <label className="admin-label">Phone</label>
      <input className="admin-input" name="phone" defaultValue={barber?.phone ?? ""} />

      <label className="admin-label">Email</label>
      <input className="admin-input" name="email" defaultValue={barber?.email ?? ""} />
      {err.email?.[0] && <p className="field-error">{err.email[0]}</p>}

      <label className="admin-label">Sort order</label>
      <input className="admin-input" type="number" name="sort_order" defaultValue={barber?.sort_order ?? 0} />

      <PhotoUploadField currentUrl={barber?.photo_url} />
      <AvailabilityEditor value={barber?.availability} />
      <ServicesMultiselect services={services} selectedIds={selectedIds} />

      <label className="admin-label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="active" defaultChecked={barber ? barber.active : true} /> Active
      </label>

      {state?.error && <p className="form-error">{state.error}</p>}
      <div className="row-actions" style={{ marginTop: "0.75rem" }}>
        <button className="admin-btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button className="admin-btn admin-btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 7: Manual verification**

Run `npm run dev`, sign in, go to `/admin/barbers`. Edit "Marcus": upload a JPEG photo (≤3 MB), toggle Wednesday closed, uncheck one service, Save. Then open `/` → Marcus shows the uploaded photo (not a monogram). Open `/booking`, pick Marcus → the unchecked service is gone; Wednesday shows no slots. Add a new barber "Test" → a slug `test` is generated and they appear on the site. Deactivate "Test" → removed from public site. Stop `npm run dev`.

- [ ] **Step 8: Commit**

```bash
git add "src/app/admin/(dash)/barbers" src/components/admin/availability-editor.js src/components/admin/services-multiselect.js src/lib/data-admin.js
git commit -m "feat: barbers CRUD with photo upload, availability, services"
```

---

## Task 13: Closures editor

**Files:**
- Modify: `src/lib/admin-validation.js`
- Modify: `src/lib/admin-validation.test.js`
- Modify: `src/lib/data-admin.js`
- Create: `src/app/admin/(dash)/closures/actions.js`
- Create: `src/app/admin/(dash)/closures/page.js`
- Create: `src/app/admin/(dash)/closures/closure-form.js`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/admin-validation.test.js`:
```js
import { closureSchema } from "./admin-validation.js";

test("closureSchema accepts whole-shop closure with empty barberId", () => {
  const parsed = closureSchema.parse({
    barber_id: "",
    start_date: "2026-07-01",
    end_date: "2026-07-03",
    reason: "Holiday",
  });
  assert.equal(parsed.barber_id, null);
  assert.equal(parsed.reason, "Holiday");
});

test("closureSchema rejects end before start", () => {
  assert.throws(() =>
    closureSchema.parse({ barber_id: "", start_date: "2026-07-05", end_date: "2026-07-01" })
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `closureSchema` not exported.

- [ ] **Step 3: Implement the closure schema**

Add to `src/lib/admin-validation.js`:
```js
export const closureSchema = z
  .object({
    barber_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Invalid barber"),
    start_date: z.string().regex(dateRe, "Invalid date"),
    end_date: z.string().regex(dateRe, "Invalid date"),
    reason: optText,
  })
  .refine((c) => c.end_date >= c.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Add closure read helper**

Add to `src/lib/data-admin.js`:
```js
export async function listClosures(supabase) {
  const { data, error } = await supabase
    .from("closures")
    .select("*, barbers(name)")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 6: Create the closures actions**

Create `src/app/admin/(dash)/closures/actions.js`:
```js
"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { closureSchema, formToObject, safeValidate } from "@/lib/admin-validation";

function revalidate() {
  revalidatePath("/admin/closures");
  revalidatePath("/booking");
}

export async function createClosure(prevState, formData) {
  const { supabase } = await requireAdmin();
  const { data, fieldErrors } = safeValidate(closureSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };
  const { error } = await supabase.from("closures").insert(data);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteClosure(id) {
  const { supabase } = await requireAdmin();
  await supabase.from("closures").delete().eq("id", id);
  revalidate();
}
```

- [ ] **Step 7: Create the closures page**

Create `src/app/admin/(dash)/closures/page.js`:
```js
import { requireAdmin } from "@/lib/supabase/ssr";
import { listClosures, listBarbers } from "@/lib/data-admin";
import ClosureForm from "./closure-form";
import ConfirmButton from "@/components/admin/confirm-button";
import { deleteClosure } from "./actions";

export default async function ClosuresPage() {
  const { supabase } = await requireAdmin();
  const [closures, barbers] = await Promise.all([listClosures(supabase), listBarbers(supabase)]);
  return (
    <>
      <h1 className="admin-h1">Closures</h1>
      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Scope</th><th>From</th><th>To</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            {closures.map((c) => (
              <tr key={c.id}>
                <td>{c.barber_id ? c.barbers?.name ?? "Barber" : "Whole shop"}</td>
                <td>{c.start_date}</td>
                <td>{c.end_date}</td>
                <td className="muted">{c.reason}</td>
                <td>
                  <ConfirmButton action={deleteClosure.bind(null, c.id)} label="Delete" confirm="Delete this closure?" danger />
                </td>
              </tr>
            ))}
            {closures.length === 0 && <tr><td colSpan={5} className="muted">No closures.</td></tr>}
          </tbody>
        </table>
      </div>
      <h2 className="admin-h2">Add a closure</h2>
      <ClosureForm barbers={barbers} />
    </>
  );
}
```

- [ ] **Step 8: Create the closure form**

Create `src/app/admin/(dash)/closures/closure-form.js`:
```js
"use client";
import { useActionState } from "react";
import { createClosure } from "./actions";

export default function ClosureForm({ barbers }) {
  const [state, formAction, pending] = useActionState(createClosure, {});
  const err = state?.fieldErrors || {};
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 420 }}>
      <label className="admin-label">Scope</label>
      <select className="admin-select" name="barber_id" defaultValue="">
        <option value="">Whole shop</option>
        {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <label className="admin-label">Start date</label>
      <input className="admin-input" type="date" name="start_date" />
      {err.start_date?.[0] && <p className="field-error">{err.start_date[0]}</p>}

      <label className="admin-label">End date</label>
      <input className="admin-input" type="date" name="end_date" />
      {err.end_date?.[0] && <p className="field-error">{err.end_date[0]}</p>}

      <label className="admin-label">Reason</label>
      <input className="admin-input" name="reason" />

      {state?.error && <p className="form-error">{state.error}</p>}
      {state?.ok && <p className="form-ok">Closure added.</p>}
      <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "0.75rem" }}>
        {pending ? "Adding…" : "Add closure"}
      </button>
    </form>
  );
}
```

- [ ] **Step 9: Manual verification**

Run `npm run dev`, sign in, go to `/admin/closures`. Add a whole-shop closure for a near-future date range. Open `/booking`, select any barber/service, navigate to a closed date → no slots are offered. Delete the closure → slots return. Stop `npm run dev`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/admin-validation.js src/lib/admin-validation.test.js src/lib/data-admin.js "src/app/admin/(dash)/closures"
git commit -m "feat: closures editor (whole-shop or per-barber)"
```

---

## Task 14: Booking reads and cancel/reschedule notifications

**Files:**
- Modify: `src/lib/data-admin.js`
- Modify: `src/lib/notifications/index.js`

**Known signatures (verified against the current code — do not change them):**
- `sendSms(to, body)` — positional; no-ops if Twilio env or `to` missing.
- `sendEmail(to, subject, html)` — positional; `html` (not text); no-ops if Resend env or `to` missing.
- `formatTime12h(timeStr)` is already imported at the top of `index.js`.
- `sendBookingNotifications({ booking, barber, service, shop })` is the pattern to mirror.

- [ ] **Step 1: Add booking read helpers**

Add to `src/lib/data-admin.js`:
```js
// Bookings list with joined barber/service names, filtered.
export async function listBookings(supabase, { from, to, barberId, status } = {}) {
  let q = supabase
    .from("bookings")
    .select("*, barbers(name), services(name, duration_minutes)")
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true });
  if (from) q = q.gte("booking_date", from);
  if (to) q = q.lte("booking_date", to);
  if (barberId) q = q.eq("barber_id", barberId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getBooking(supabase, id) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, barbers(name), services(name, duration_minutes)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Non-cancelled bookings for a barber on a date, optionally excluding one id.
export async function bookingsForSlotCheck(supabase, barberId, date, excludeId = null) {
  let q = supabase
    .from("bookings")
    .select("id, booking_time, services(duration_minutes)")
    .eq("barber_id", barberId)
    .eq("booking_date", date)
    .neq("status", "cancelled");
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((b) => ({
    id: b.id,
    booking_time: b.booking_time,
    duration_minutes: b.services?.duration_minutes ?? 0,
  }));
}
```

- [ ] **Step 2: Add cancellation + reschedule senders to the notifications module**

Append to `src/lib/notifications/index.js` (the file already imports `sendSms`, `sendEmail`, and `formatTime12h` — reuse them; do not re-import). Note the **positional** `sendEmail(to, subject, html)` signature:
```js
export async function sendCancellation({ booking, barber, service, shop }) {
  const when = `${booking.booking_date} at ${formatTime12h(booking.booking_time)}`;
  const text = `${shop?.name ?? "The Blade"}: your ${service?.name ?? "appointment"} with ${barber?.name ?? "us"} on ${when} has been cancelled. Call us to rebook.`;
  const html = `<h2>${shop?.name ?? "The Blade"}</h2><p>Hi ${booking.customer_name}, your booking on ${when} has been cancelled.</p><p>Call us to rebook.</p>`;
  const results = await Promise.allSettled([
    sendSms(booking.customer_phone || null, text),
    sendEmail(booking.customer_email || null, `Booking cancelled — ${shop?.name ?? "The Blade"}`, html),
  ]);
  return { results };
}

export async function sendReschedule({ booking, barber, service, shop }) {
  const when = `${booking.booking_date} at ${formatTime12h(booking.booking_time)}`;
  const text = `${shop?.name ?? "The Blade"}: your ${service?.name ?? "appointment"} with ${barber?.name ?? "us"} has been moved to ${when}. See you then!`;
  const html = `<h2>${shop?.name ?? "The Blade"}</h2><p>Hi ${booking.customer_name}, your booking has been moved to <strong>${when}</strong> with ${barber?.name ?? "us"}.</p>`;
  const results = await Promise.allSettled([
    sendSms(booking.customer_phone || null, text),
    sendEmail(booking.customer_email || null, `Booking updated — ${shop?.name ?? "The Blade"}`, html),
  ]);
  return { results };
}
```

- [ ] **Step 3: Verify the module compiles**

Run:
```bash
npm run build
```
Expected: clean build. (Do not `node -e import` this file — it begins with `import "server-only"`, which throws outside the Next bundler.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/data-admin.js src/lib/notifications/index.js
git commit -m "feat: admin booking reads and cancel/reschedule notifications"
```

---

## Task 15: Bookings list with complete / cancel / no-show

**Files:**
- Create: `src/app/admin/(dash)/bookings/actions.js`
- Create: `src/app/admin/(dash)/bookings/page.js`
- Create: `src/app/admin/(dash)/bookings/filters.js`

- [ ] **Step 1: Create the booking status actions**

Create `src/app/admin/(dash)/bookings/actions.js`:
```js
"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { getBooking, getShopSettings } from "@/lib/data-admin";
import { sendCancellation } from "@/lib/notifications";

export async function setBookingStatus(id, status) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) throw error;

  if (status === "cancelled") {
    // Notify the customer (fail-soft).
    try {
      const booking = await getBooking(supabase, id);
      const shop = await getShopSettings(supabase);
      await sendCancellation({
        booking,
        barber: booking.barbers,
        service: booking.services,
        shop,
      });
    } catch (e) {
      console.error("Cancellation notify failed:", e?.message);
    }
  }
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}
```

- [ ] **Step 2: Create the filters component**

Create `src/app/admin/(dash)/bookings/filters.js`:
```js
"use client";
import { useRouter, useSearchParams } from "next/navigation";

export default function BookingFilters({ barbers }) {
  const router = useRouter();
  const params = useSearchParams();
  function set(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/bookings?${next.toString()}`);
  }
  return (
    <div className="admin-card" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
      <div>
        <label className="admin-label">From</label>
        <input className="admin-input" type="date" defaultValue={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} />
      </div>
      <div>
        <label className="admin-label">To</label>
        <input className="admin-input" type="date" defaultValue={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} />
      </div>
      <div>
        <label className="admin-label">Barber</label>
        <select className="admin-select" defaultValue={params.get("barberId") ?? ""} onChange={(e) => set("barberId", e.target.value)}>
          <option value="">All</option>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="admin-label">Status</label>
        <select className="admin-select" defaultValue={params.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
          <option value="">All</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the bookings page**

Create `src/app/admin/(dash)/bookings/page.js`:
```js
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/ssr";
import { listBookings, listBarbers } from "@/lib/data-admin";
import BookingFilters from "./filters";
import ConfirmButton from "@/components/admin/confirm-button";
import { setBookingStatus } from "./actions";

export default async function BookingsPage({ searchParams }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const [bookings, barbers] = await Promise.all([
    listBookings(supabase, {
      from: sp.from,
      to: sp.to,
      barberId: sp.barberId,
      status: sp.status,
    }),
    listBarbers(supabase),
  ]);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="admin-h1">Bookings</h1>
        <Link className="admin-btn" href="/admin/bookings/new">+ New booking</Link>
      </div>
      <BookingFilters barbers={barbers} />
      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Barber</th><th>Service</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{b.booking_date}</td>
                <td>{String(b.booking_time).slice(0, 5)}</td>
                <td>{b.customer_name}<br /><span className="muted">{b.customer_phone || b.customer_email}</span></td>
                <td>{b.barbers?.name}</td>
                <td>{b.services?.name}</td>
                <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                <td className="row-actions">
                  {b.status === "confirmed" && (
                    <>
                      <Link className="admin-btn admin-btn-secondary" href={`/admin/bookings/${b.id}/reschedule`}>Reschedule</Link>
                      <ConfirmButton action={setBookingStatus.bind(null, b.id, "completed")} label="Complete" />
                      <ConfirmButton action={setBookingStatus.bind(null, b.id, "no_show")} label="No-show" confirm="Mark as no-show?" />
                      <ConfirmButton action={setBookingStatus.bind(null, b.id, "cancelled")} label="Cancel" confirm="Cancel and notify the customer?" danger />
                    </>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={7} className="muted">No bookings match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, sign in. First create a test booking via the public `/booking` flow (so there is data). Go to `/admin/bookings` → it appears. Filter by status "confirmed". Click "Complete" → status badge becomes "completed" and action buttons disappear. Create another booking, click "Cancel" → confirm dialog appears; on confirm the slot frees (re-check `/booking` shows that time available again) and the server logs a notification attempt (no Twilio/Resend keys = no-op). Stop `npm run dev`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dash)/bookings/actions.js" "src/app/admin/(dash)/bookings/page.js" "src/app/admin/(dash)/bookings/filters.js"
git commit -m "feat: bookings list with complete/cancel/no-show and filters"
```

---

## Task 16: Reschedule helper and manual-booking/reschedule schemas

**Files:**
- Create: `src/lib/reschedule.js`
- Create: `src/lib/reschedule.test.js`
- Modify: `src/lib/admin-validation.js`
- Modify: `src/lib/admin-validation.test.js`

- [ ] **Step 1: Write the failing reschedule-helper test**

Create `src/lib/reschedule.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { otherBookings } from "./reschedule.js";

test("otherBookings drops the booking being moved", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(otherBookings(list, "b"), [{ id: "a" }, { id: "c" }]);
});

test("otherBookings returns all when excludeId is null", () => {
  const list = [{ id: "a" }];
  assert.deepEqual(otherBookings(list, null), [{ id: "a" }]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `./reschedule.js` not found.

- [ ] **Step 3: Implement the helper**

Create `src/lib/reschedule.js`:
```js
// Remove the booking currently being moved so it doesn't block its own slot.
export function otherBookings(bookings, excludeId) {
  if (!excludeId) return bookings;
  return bookings.filter((b) => b.id !== excludeId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Write failing tests for the two new schemas**

Add to `src/lib/admin-validation.test.js`:
```js
import { manualBookingSchema, rescheduleSchema } from "./admin-validation.js";

test("manualBookingSchema allows empty phone and email", () => {
  const parsed = manualBookingSchema.parse({
    barberId: "11111111-1111-1111-1111-111111111111",
    serviceId: "22222222-2222-2222-2222-222222222222",
    customerName: "Walk In",
    customerPhone: "",
    customerEmail: "",
    date: "2026-07-01",
    time: "10:00",
  });
  assert.equal(parsed.customerName, "Walk In");
  assert.equal(parsed.customerPhone, "");
});

test("manualBookingSchema requires a name", () => {
  assert.throws(() =>
    manualBookingSchema.parse({
      barberId: "11111111-1111-1111-1111-111111111111",
      serviceId: "22222222-2222-2222-2222-222222222222",
      customerName: "",
      date: "2026-07-01",
      time: "10:00",
    })
  );
});

test("rescheduleSchema validates barber, date, time", () => {
  const parsed = rescheduleSchema.parse({
    barberId: "11111111-1111-1111-1111-111111111111",
    date: "2026-07-02",
    time: "11:30",
  });
  assert.equal(parsed.time, "11:30");
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL — `manualBookingSchema` / `rescheduleSchema` not exported.

- [ ] **Step 7: Implement the schemas**

Add to `src/lib/admin-validation.js`:
```js
export const manualBookingSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  customerName: z.string().trim().min(1, "Name is required").max(120),
  customerPhone: z.string().trim().max(32).optional().default(""),
  customerEmail: optEmail,
  date: z.string().regex(dateRe, "Invalid date"),
  time: z.string().regex(timeRe, "Invalid time"),
});

export const rescheduleSchema = z.object({
  barberId: z.string().uuid(),
  date: z.string().regex(dateRe, "Invalid date"),
  time: z.string().regex(timeRe, "Invalid time"),
});
```

- [ ] **Step 8: Run the test to verify it passes**

Run:
```bash
npm test
```
Expected: PASS — all admin-validation and reschedule tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/reschedule.js src/lib/reschedule.test.js src/lib/admin-validation.js src/lib/admin-validation.test.js
git commit -m "feat: reschedule helper and manual-booking/reschedule schemas"
```

---

## Task 17: Reschedule a booking

**Files:**
- Create: `src/components/admin/slot-picker.js`
- Create: `src/app/admin/(dash)/bookings/[id]/reschedule/actions.js`
- Create: `src/app/admin/(dash)/bookings/[id]/reschedule/page.js`

- [ ] **Step 1: Create a reusable slot picker (client)**

Create `src/components/admin/slot-picker.js`:
```js
"use client";
import { useEffect, useState } from "react";

// Fetches slots from the existing public availability API and renders radio options.
// excludeId is passed so the API can ignore the booking being moved.
export default function SlotPicker({ barberId, serviceId, excludeId = "" }) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    const url = `/api/availability?barberId=${barberId}&serviceId=${serviceId}&date=${date}${excludeId ? `&excludeId=${excludeId}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []))
      .finally(() => setLoading(false));
  }, [date, barberId, serviceId, excludeId]);

  return (
    <div>
      <input type="hidden" name="date" value={date} readOnly />
      <label className="admin-label">Date</label>
      <input className="admin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="admin-label">Time</label>
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && date && slots.length === 0 ? <p className="muted">No slots available.</p> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {slots.map((s) => (
          <label key={s} className="badge badge-confirmed" style={{ cursor: "pointer" }}>
            <input type="radio" name="time" value={s} required /> {s}
          </label>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Extend the availability API to honor `excludeId`**

The reschedule picker passes `excludeId` so the booking being moved doesn't block its own slot. Replace the entire contents of `src/app/api/availability/route.js` with the version below. The only changes from the current file are: import `otherBookings`, read `excludeId`, add `id` to the bookings select + mapped object, and filter with `otherBookings`. It is backward compatible — when `excludeId` is absent, `otherBookings` returns the list unchanged, and `getAvailableSlots` ignores the extra `id` field.
```js
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server.js";
import { getAvailableSlots } from "@/lib/availability.js";
import { availabilityQuerySchema } from "@/lib/validation.js";
import { otherBookings } from "@/lib/reschedule.js";

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
  const excludeId = searchParams.get("excludeId");
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
    .select("id, booking_time, services(duration_minutes)")
    .eq("barber_id", barberId)
    .eq("booking_date", date)
    .neq("status", "cancelled");

  const mapped = (bookings ?? []).map((b) => ({
    id: b.id,
    booking_time: b.booking_time.slice(0, 5),
    duration_minutes: b.services?.duration_minutes ?? 0,
  }));
  const existingBookings = otherBookings(mapped, excludeId);

  const { data: closures } = await db
    .from("closures")
    .select("barber_id,start_date,end_date")
    .lte("start_date", date)
    .gte("end_date", date);

  const slots = getAvailableSlots({
    barber,
    service,
    date,
    existingBookings,
    closures: closures ?? [],
    now: new Date(),
    timezone: shop?.timezone ?? "Europe/London",
  });

  return NextResponse.json({ slots });
}
```

- [ ] **Step 3: Create the reschedule action**

Create `src/app/admin/(dash)/bookings/[id]/reschedule/actions.js`:
```js
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/ssr";
import { getBooking, getShopSettings } from "@/lib/data-admin";
import { rescheduleSchema, formToObject, safeValidate } from "@/lib/admin-validation";
import { sendReschedule } from "@/lib/notifications";

export async function reschedule(prevState, formData) {
  const { supabase } = await requireAdmin();
  const id = formData.get("id");
  const { data, fieldErrors } = safeValidate(rescheduleSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("bookings")
    .update({ barber_id: data.barberId, booking_date: data.date, booking_time: data.time })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "That slot was just taken. Pick another time." };
    return { error: error.message };
  }

  try {
    const booking = await getBooking(supabase, id);
    const shop = await getShopSettings(supabase);
    await sendReschedule({ booking, barber: booking.barbers, service: booking.services, shop });
  } catch (e) {
    console.error("Reschedule notify failed:", e?.message);
  }

  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}
```

- [ ] **Step 4: Create the reschedule page**

Create `src/app/admin/(dash)/bookings/[id]/reschedule/page.js`:
```js
import { requireAdmin } from "@/lib/supabase/ssr";
import { getBooking, listBarbers } from "@/lib/data-admin";
import RescheduleForm from "./reschedule-form";

export default async function ReschedulePage({ params }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [booking, barbers] = await Promise.all([getBooking(supabase, id), listBarbers(supabase)]);
  return (
    <>
      <h1 className="admin-h1">Reschedule</h1>
      <p className="muted">
        {booking.customer_name} — {booking.services?.name} (currently {booking.booking_date} {String(booking.booking_time).slice(0, 5)} with {booking.barbers?.name})
      </p>
      <RescheduleForm booking={booking} barbers={barbers} />
    </>
  );
}
```

- [ ] **Step 5: Create the reschedule form**

Create `src/app/admin/(dash)/bookings/[id]/reschedule/reschedule-form.js`:
```js
"use client";
import { useState } from "react";
import { useActionState } from "react";
import { reschedule } from "./actions";
import SlotPicker from "@/components/admin/slot-picker";

export default function RescheduleForm({ booking, barbers }) {
  const [barberId, setBarberId] = useState(booking.barber_id);
  const [state, formAction, pending] = useActionState(reschedule, {});
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 460 }}>
      <input type="hidden" name="id" defaultValue={booking.id} />
      <input type="hidden" name="barberId" value={barberId} readOnly />

      <label className="admin-label">Barber</label>
      <select className="admin-select" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
        {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <SlotPicker barberId={barberId} serviceId={booking.service_id} excludeId={booking.id} />

      {state?.error && <p className="form-error">{state.error}</p>}
      <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "0.75rem" }}>
        {pending ? "Saving…" : "Confirm new time"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Manual verification**

Run `npm run dev`, sign in. Create a confirmed booking via `/booking`. In `/admin/bookings`, click "Reschedule". Pick a new date → slots load (the booking's own current slot is offered because it's excluded). Choose a time, confirm → redirected to the list with the new date/time. Verify the old slot is free and the new slot is taken on `/booking`. Stop `npm run dev`.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/slot-picker.js "src/app/admin/(dash)/bookings/[id]" src/app/api/availability/route.js
git commit -m "feat: reschedule a booking via live availability with notify"
```

---

## Task 18: Manual booking creation

**Files:**
- Create: `src/app/admin/(dash)/bookings/new/actions.js`
- Create: `src/app/admin/(dash)/bookings/new/page.js`
- Create: `src/app/admin/(dash)/bookings/new/manual-form.js`

- [ ] **Step 1: Create the manual-create action**

Create `src/app/admin/(dash)/bookings/new/actions.js`:
```js
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/ssr";
import { manualBookingSchema, formToObject, safeValidate } from "@/lib/admin-validation";

export async function createBooking(prevState, formData) {
  const { supabase } = await requireAdmin();
  const { data, fieldErrors } = safeValidate(manualBookingSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase.from("bookings").insert({
    barber_id: data.barberId,
    service_id: data.serviceId,
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    customer_email: data.customerEmail,
    booking_date: data.date,
    booking_time: data.time,
    status: "confirmed",
  });

  if (error) {
    if (error.code === "23505") return { error: "That slot is already booked. Pick another time." };
    return { error: error.message };
  }
  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}
```

- [ ] **Step 2: Create the manual-create page**

Create `src/app/admin/(dash)/bookings/new/page.js`:
```js
import { requireAdmin } from "@/lib/supabase/ssr";
import { listBarbers, listServices } from "@/lib/data-admin";
import ManualForm from "./manual-form";

export default async function NewBookingPage() {
  const { supabase } = await requireAdmin();
  const [barbers, services] = await Promise.all([listBarbers(supabase), listServices(supabase)]);
  return (
    <>
      <h1 className="admin-h1">New booking</h1>
      <ManualForm barbers={barbers.filter((b) => b.active)} services={services.filter((s) => s.active)} />
    </>
  );
}
```

- [ ] **Step 3: Create the manual-create form**

Create `src/app/admin/(dash)/bookings/new/manual-form.js`:
```js
"use client";
import { useState } from "react";
import { useActionState } from "react";
import { createBooking } from "./actions";
import SlotPicker from "@/components/admin/slot-picker";

export default function ManualForm({ barbers, services }) {
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(createBooking, {});
  const err = state?.fieldErrors || {};
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 460 }}>
      <input type="hidden" name="barberId" value={barberId} readOnly />
      <input type="hidden" name="serviceId" value={serviceId} readOnly />

      <label className="admin-label">Barber</label>
      <select className="admin-select" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
        {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <label className="admin-label">Service</label>
      <select className="admin-select" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</option>)}
      </select>

      <label className="admin-label">Customer name</label>
      <input className="admin-input" name="customerName" />
      {err.customerName?.[0] && <p className="field-error">{err.customerName[0]}</p>}

      <label className="admin-label">Phone (optional)</label>
      <input className="admin-input" name="customerPhone" />

      <label className="admin-label">Email (optional)</label>
      <input className="admin-input" name="customerEmail" />
      {err.customerEmail?.[0] && <p className="field-error">{err.customerEmail[0]}</p>}

      <SlotPicker barberId={barberId} serviceId={serviceId} />

      {state?.error && <p className="form-error">{state.error}</p>}
      <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "0.75rem" }}>
        {pending ? "Creating…" : "Create booking"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, sign in, go to `/admin/bookings/new`. Pick a barber + service, choose a date → slots load. Enter only a customer name (leave phone/email blank), pick a slot, create → redirected to the list with the new confirmed booking. Confirm the slot is now blocked on `/booking`. Try booking the same slot again manually → friendly "already booked" error. Stop `npm run dev`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dash)/bookings/new"
git commit -m "feat: manual booking creation for walk-ins/phone"
```

---

## Task 19: Dashboard home (today + quick counts)

**Files:**
- Modify: `src/lib/data-admin.js`
- Modify: `src/app/admin/(dash)/page.js`

- [ ] **Step 1: Add a dashboard summary helper**

Add to `src/lib/data-admin.js`:
```js
import { TZDate } from "@date-fns/tz";

// Returns today's date string (YYYY-MM-DD) in the shop timezone.
export function todayInTz(timezone) {
  const n = new TZDate(new Date(), timezone);
  return [
    n.getFullYear(),
    String(n.getMonth() + 1).padStart(2, "0"),
    String(n.getDate()).padStart(2, "0"),
  ].join("-");
}

export async function getDashboardData(supabase, timezone) {
  const today = todayInTz(timezone);
  const todays = await listBookings(supabase, { from: today, to: today });
  const upcoming = await listBookings(supabase, { from: today, status: "confirmed" });
  return {
    today,
    todays,
    counts: {
      todayTotal: todays.length,
      upcomingConfirmed: upcoming.length,
    },
  };
}
```

- [ ] **Step 2: Replace the dashboard home page**

Replace the entire contents of `src/app/admin/(dash)/page.js`:
```js
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/ssr";
import { getShopSettings, getDashboardData } from "@/lib/data-admin";

export default async function DashboardHome() {
  const { supabase, user } = await requireAdmin();
  const shop = await getShopSettings(supabase);
  const { today, todays, counts } = await getDashboardData(supabase, shop.timezone);

  return (
    <>
      <h1 className="admin-h1">Dashboard</h1>
      <p className="muted">Signed in as {user.email}.</p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", margin: "1rem 0" }}>
        <div className="admin-card" style={{ minWidth: 160 }}>
          <div className="muted">Today’s bookings</div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>{counts.todayTotal}</div>
        </div>
        <div className="admin-card" style={{ minWidth: 160 }}>
          <div className="muted">Upcoming confirmed</div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>{counts.upcomingConfirmed}</div>
        </div>
      </div>

      <h2 className="admin-h2">Today — {today}</h2>
      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Time</th><th>Customer</th><th>Barber</th><th>Service</th><th>Status</th></tr></thead>
          <tbody>
            {todays.map((b) => (
              <tr key={b.id}>
                <td>{String(b.booking_time).slice(0, 5)}</td>
                <td>{b.customer_name}</td>
                <td>{b.barbers?.name}</td>
                <td>{b.services?.name}</td>
                <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
              </tr>
            ))}
            {todays.length === 0 && <tr><td colSpan={5} className="muted">No bookings today.</td></tr>}
          </tbody>
        </table>
        <Link className="admin-btn" href="/admin/bookings" style={{ marginTop: "0.75rem" }}>All bookings</Link>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, sign in → the dashboard shows the two count cards and a "Today" table. If a booking exists for today it appears; the counts are correct. Stop `npm run dev`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data-admin.js "src/app/admin/(dash)/page.js"
git commit -m "feat: dashboard home with today's bookings and quick counts"
```

---

## Task 20: Final verification and finish

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run:
```bash
npm test
```
Expected: all tests pass (the original 16 plus the new schema/slug/reschedule tests).

- [ ] **Step 2: Production build**

Run:
```bash
npm run build
```
Expected: clean build; route list shows `/admin/login`, `/admin`, `/admin/bookings`, `/admin/bookings/new`, `/admin/bookings/[id]/reschedule`, `/admin/barbers`, `/admin/services`, `/admin/closures`, `/admin/shop`, and `ƒ Middleware`.

- [ ] **Step 3: Full live admin pass (dev server)**

Run `npm run dev` and verify, signed in as the owner:
1. Gate: logged-out `/admin/bookings` → redirect to login.
2. Shop: edit tagline → shows on `/`.
3. Services: add/edit/deactivate → reflected on `/` and `/booking`.
4. Barbers: photo upload renders via `next/image` on `/`; availability + services edits reflected on `/booking`; new barber gets a slug.
5. Closures: add → date blocked on `/booking`; delete → unblocked.
6. Bookings: complete, no-show, cancel (cancel frees the slot).
7. Reschedule: move a booking; old slot frees, new slot blocks.
8. Manual create: name-only walk-in booking; double-book rejected.
9. Dashboard: counts + today's table correct.

Stop `npm run dev`.

- [ ] **Step 4: Update the README roadmap**

In `README.md`, move the Spec 2 line out of the roadmap into a new "What works (Spec 2)" section summarizing the admin dashboard, and note that the owner account is seeded via `node --env-file=.env.local scripts/create-admin.mjs`. Commit:
```bash
git add README.md
git commit -m "docs: document admin dashboard (Spec 2)"
```

- [ ] **Step 5: Finish the development branch**

**REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch to verify tests, present merge/PR options, and complete the work.

---

## Self-Review notes (for the executor)

- **Spec coverage:** auth+gate (T2,3,6), owner seed (T4), login (T5), shop editor (T7), services (T8), slug (T9), barber schemas (T10), storage+upload (T11), barbers full (T12), closures (T13), booking reads+notify (T14), bookings ops (T15), reschedule+manual schemas (T16), reschedule (T17), manual create (T18), dashboard (T19). All spec sections map to a task.
- **Soft-delete:** services/barbers use `active` toggles (T8/T12); closures hard-delete (T13); bookings cancel = status change (T15). Matches spec.
- **Type consistency:** `requireAdmin()` returns `{ supabase, user }` everywhere; `safeValidate` returns `{ data }` or `{ fieldErrors }` everywhere; `formToObject` used for all string forms; `serviceIds` collected via `formData.getAll`; availability submitted as JSON string and parsed with `availabilitySchema`. The availability API change in T17 is backward-compatible (no `excludeId` ⇒ unchanged behavior).
- **Integration points (now closed with exact code):** T14 uses the verified positional `sendSms(to, body)` / `sendEmail(to, subject, html)` signatures and reuses the already-imported `formatTime12h`. T17 ships a full backward-compatible replacement of `src/app/api/availability/route.js` (adds `id` to the bookings select + `excludeId` filtering; unchanged behavior when `excludeId` is absent).

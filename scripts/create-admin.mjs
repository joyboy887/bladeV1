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

// Register the user in public.admins so RLS (is_admin()) grants dashboard
// access. Without this row the user can log in but every table reads as empty.
const adminRes = await fetch(`${url}/rest/v1/admins`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates",
  },
  body: JSON.stringify({ user_id: body.id, email: body.email }),
});

if (!adminRes.ok) {
  console.error("Created auth user but FAILED to add to admins table:", await adminRes.text());
  console.error("Add it manually: insert into public.admins (user_id, email) values ('" + body.id + "', '" + body.email + "');");
  process.exit(1);
}
console.log("Registered in admins table. Also add this email to ADMIN_EMAILS.");

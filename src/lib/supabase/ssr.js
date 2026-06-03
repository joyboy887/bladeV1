import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { isAdminEmail } from "@/lib/admin-allowlist";

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
// Returns { supabase, user }; redirects to /admin/login if the caller is not an
// authenticated user whose email is on the ADMIN_EMAILS allowlist. Authentication
// alone is NOT enough — admin privilege is enforced explicitly here, independent
// of Supabase project signup configuration.
export async function requireAdmin() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Require a confirmed email before trusting it against the allowlist —
  // an unverified email is mutable/unproven and must be treated as anonymous.
  if (!user || !user.email_confirmed_at || !isAdminEmail(user.email)) {
    redirect("/admin/login");
  }
  return { supabase, user };
}

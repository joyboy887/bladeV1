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

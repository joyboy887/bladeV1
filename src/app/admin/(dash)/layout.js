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

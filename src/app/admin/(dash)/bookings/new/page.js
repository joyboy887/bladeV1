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

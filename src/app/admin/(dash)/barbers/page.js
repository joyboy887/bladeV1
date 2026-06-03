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

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

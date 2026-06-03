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

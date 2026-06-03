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

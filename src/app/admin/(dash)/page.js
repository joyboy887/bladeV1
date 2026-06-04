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
          <div className="muted">Today&apos;s bookings</div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>{counts.todayTotal}</div>
        </div>
        <div className="admin-card" style={{ minWidth: 160 }}>
          <div className="muted">Upcoming confirmed</div>
          <div style={{ fontSize: "2rem", fontWeight: 700 }}>{counts.upcomingConfirmed}</div>
        </div>
      </div>

      <h2 className="admin-h2">Today &mdash; {today}</h2>
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

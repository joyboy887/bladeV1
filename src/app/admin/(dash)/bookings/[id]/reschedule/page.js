import { requireAdmin } from "@/lib/supabase/ssr";
import { getBooking, listBarbers } from "@/lib/data-admin";
import RescheduleForm from "./reschedule-form";

export default async function ReschedulePage({ params }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [booking, barbers] = await Promise.all([getBooking(supabase, id), listBarbers(supabase)]);
  return (
    <>
      <h1 className="admin-h1">Reschedule</h1>
      <p className="muted">
        {booking.customer_name} — {booking.services?.name} (currently {booking.booking_date} {String(booking.booking_time).slice(0, 5)} with {booking.barbers?.name})
      </p>
      <RescheduleForm booking={booking} barbers={barbers} />
    </>
  );
}

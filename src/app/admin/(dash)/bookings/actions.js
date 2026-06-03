"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { getBooking, getShopSettings } from "@/lib/data-admin";
import { sendCancellation } from "@/lib/notifications";

export async function setBookingStatus(id, status) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) throw error;

  if (status === "cancelled") {
    // Notify the customer (fail-soft).
    try {
      const booking = await getBooking(supabase, id);
      const shop = await getShopSettings(supabase);
      await sendCancellation({
        booking,
        barber: booking.barbers,
        service: booking.services,
        shop,
      });
    } catch (e) {
      console.error("Cancellation notify failed:", e?.message);
    }
  }
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}

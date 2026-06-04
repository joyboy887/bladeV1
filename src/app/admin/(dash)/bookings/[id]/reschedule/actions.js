"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/ssr";
import { getBooking, getShopSettings } from "@/lib/data-admin";
import { rescheduleSchema, formToObject, safeValidate } from "@/lib/admin-validation";
import { sendReschedule } from "@/lib/notifications";

export async function reschedule(prevState, formData) {
  const { supabase } = await requireAdmin();
  const id = formData.get("id");
  const { data, fieldErrors } = safeValidate(rescheduleSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("bookings")
    .update({ barber_id: data.barberId, booking_date: data.date, booking_time: data.time })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "That slot was just taken. Pick another time." };
    return { error: error.message };
  }

  try {
    const booking = await getBooking(supabase, id);
    const shop = await getShopSettings(supabase);
    await sendReschedule({ booking, barber: booking.barbers, service: booking.services, shop });
  } catch (e) {
    console.error("Reschedule notify failed:", e?.message);
  }

  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}

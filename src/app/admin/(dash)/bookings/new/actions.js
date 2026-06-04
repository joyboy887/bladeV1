"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/ssr";
import { manualBookingSchema, formToObject, safeValidate } from "@/lib/admin-validation";

export async function createBooking(prevState, formData) {
  const { supabase } = await requireAdmin();
  const { data, fieldErrors } = safeValidate(manualBookingSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase.from("bookings").insert({
    barber_id: data.barberId,
    service_id: data.serviceId,
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    customer_email: data.customerEmail,
    booking_date: data.date,
    booking_time: data.time,
    status: "confirmed",
  });

  if (error) {
    if (error.code === "23505") return { error: "That slot is already booked. Pick another time." };
    return { error: error.message };
  }
  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}

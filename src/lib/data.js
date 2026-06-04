import "server-only";
import { createServiceClient } from "@/lib/supabase/server.js";

// All reads use the service client (server-only). Public pages call these
// from Server Components; values are safe to expose (no secrets in rows).

export async function getShopSettings() {
  const db = createServiceClient();
  const { data, error } = await db.from("shop_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function getActiveBarbers() {
  const db = createServiceClient();
  const { data, error } = await db
    .from("barbers")
    .select("id,name,slug,photo_url,bio,availability,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getActiveServices() {
  const db = createServiceClient();
  const { data, error } = await db
    .from("services")
    .select("id,name,description,duration_minutes,price,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getBarberServiceLinks() {
  const db = createServiceClient();
  const { data, error } = await db.from("barber_services").select("barber_id,service_id");
  if (error) throw error;
  return data;
}

export async function getBookingById(id, token) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("bookings")
    .select(
      "id,barber_id,service_id,customer_name,customer_email,customer_phone,booking_date,booking_time,status,manage_token"
    )
    .eq("id", id)
    .single();
  if (error) return null;
  if (!data || data.manage_token !== token) return null;
  return data;
}

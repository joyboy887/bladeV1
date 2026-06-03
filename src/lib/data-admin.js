import "server-only";

// All helpers take an authenticated session client (from requireAdmin()).

export async function getShopSettings(supabase) {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

export async function listServices(supabase) {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listBarbers(supabase) {
  const { data, error } = await supabase
    .from("barbers")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listBarberServiceIds(supabase, barberId) {
  const { data, error } = await supabase
    .from("barber_services")
    .select("service_id")
    .eq("barber_id", barberId);
  if (error) throw error;
  return data.map((r) => r.service_id);
}

export async function listAllSlugs(supabase) {
  const { data, error } = await supabase.from("barbers").select("slug");
  if (error) throw error;
  return data.map((r) => r.slug);
}

export async function listClosures(supabase) {
  const { data, error } = await supabase
    .from("closures")
    .select("*, barbers(name)")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data;
}

// Bookings list with joined barber/service names, filtered.
export async function listBookings(supabase, { from, to, barberId, status } = {}) {
  let q = supabase
    .from("bookings")
    .select("*, barbers(name), services(name, duration_minutes)")
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true });
  if (from) q = q.gte("booking_date", from);
  if (to) q = q.lte("booking_date", to);
  if (barberId) q = q.eq("barber_id", barberId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getBooking(supabase, id) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, barbers(name), services(name, duration_minutes)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Non-cancelled bookings for a barber on a date, optionally excluding one id.
export async function bookingsForSlotCheck(supabase, barberId, date, excludeId = null) {
  let q = supabase
    .from("bookings")
    .select("id, booking_time, services(duration_minutes)")
    .eq("barber_id", barberId)
    .eq("booking_date", date)
    .neq("status", "cancelled");
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((b) => ({
    id: b.id,
    booking_time: b.booking_time,
    duration_minutes: b.services?.duration_minutes ?? 0,
  }));
}

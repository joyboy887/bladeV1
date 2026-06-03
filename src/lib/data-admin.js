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

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

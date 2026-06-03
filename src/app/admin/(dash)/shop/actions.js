"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { shopSchema, formToObject, safeValidate } from "@/lib/admin-validation";

export async function updateShop(prevState, formData) {
  const { supabase } = await requireAdmin();
  const { data, fieldErrors } = safeValidate(shopSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("shop_settings")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/admin/shop");
  revalidatePath("/");
  revalidatePath("/booking");
  return { ok: true };
}

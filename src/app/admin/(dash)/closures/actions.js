"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { closureSchema, formToObject, safeValidate } from "@/lib/admin-validation";

function revalidate() {
  revalidatePath("/admin/closures");
  revalidatePath("/booking");
}

export async function createClosure(prevState, formData) {
  const { supabase } = await requireAdmin();
  const { data, fieldErrors } = safeValidate(closureSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };
  const { error } = await supabase.from("closures").insert(data);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteClosure(id) {
  const { supabase } = await requireAdmin();
  await supabase.from("closures").delete().eq("id", id);
  revalidate();
}

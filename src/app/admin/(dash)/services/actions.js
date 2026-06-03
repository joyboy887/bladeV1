"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { serviceSchema, formToObject, safeValidate } from "@/lib/admin-validation";

function revalidate() {
  revalidatePath("/admin/services");
  revalidatePath("/");
  revalidatePath("/booking");
}

export async function saveService(prevState, formData) {
  const { supabase } = await requireAdmin();
  const id = formData.get("id"); // empty string for new
  const { data, fieldErrors } = safeValidate(serviceSchema, formToObject(formData));
  if (fieldErrors) return { fieldErrors };

  let error;
  if (id) {
    ({ error } = await supabase.from("services").update(data).eq("id", id));
  } else {
    ({ error } = await supabase.from("services").insert(data));
  }
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

export async function setServiceActive(id, active) {
  const { supabase } = await requireAdmin();
  await supabase.from("services").update({ active }).eq("id", id);
  revalidate();
}

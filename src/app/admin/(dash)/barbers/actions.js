"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/ssr";
import { barberSchema, availabilitySchema, formToObject, safeValidate } from "@/lib/admin-validation";
import { slugify, uniqueSlug } from "@/lib/slug";
import { listAllSlugs, listBarberServiceIds } from "@/lib/data-admin";

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

function revalidate() {
  revalidatePath("/admin/barbers");
  revalidatePath("/");
  revalidatePath("/booking");
}

async function syncServices(supabase, barberId, serviceIds) {
  const existing = await listBarberServiceIds(supabase, barberId);
  const want = new Set(serviceIds);
  const have = new Set(existing);
  const toAdd = serviceIds.filter((id) => !have.has(id));
  const toRemove = existing.filter((id) => !want.has(id));
  if (toAdd.length) {
    await supabase.from("barber_services").insert(toAdd.map((service_id) => ({ barber_id: barberId, service_id })));
  }
  for (const service_id of toRemove) {
    await supabase.from("barber_services").delete().eq("barber_id", barberId).eq("service_id", service_id);
  }
}

async function uploadPhoto(supabase, barberId, file) {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (!TYPES.includes(file.type)) return { error: "Photo must be JPEG, PNG, or WebP." };
  if (file.size > MAX_BYTES) return { error: "Photo must be 3 MB or smaller." };
  const ext = file.type.split("/")[1];
  const path = `barbers/${barberId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function saveBarber(prevState, formData) {
  const { supabase } = await requireAdmin();
  const obj = formToObject(formData);
  obj.serviceIds = formData.getAll("serviceIds");
  const { data, fieldErrors } = safeValidate(barberSchema, obj);
  if (fieldErrors) return { fieldErrors };

  // Availability comes as a JSON string from the editor.
  let availability;
  try {
    availability = availabilitySchema.parse(JSON.parse(formData.get("availability") || "{}"));
  } catch (e) {
    return { error: "Invalid availability." };
  }

  const id = formData.get("id");
  const row = {
    name: data.name,
    bio: data.bio,
    phone: data.phone,
    email: data.email,
    sort_order: data.sort_order,
    active: data.active,
    availability,
  };

  let barberId = id || null;
  if (id) {
    const { error } = await supabase.from("barbers").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const slugs = await listAllSlugs(supabase);
    row.slug = uniqueSlug(slugify(data.name), slugs);
    const { data: inserted, error } = await supabase.from("barbers").insert(row).select("id").single();
    if (error) return { error: error.message };
    barberId = inserted.id;
  }

  const photoResult = await uploadPhoto(supabase, barberId, formData.get("photo"));
  if (photoResult?.error) return { error: photoResult.error };
  if (photoResult?.url) {
    await supabase.from("barbers").update({ photo_url: photoResult.url }).eq("id", barberId);
  }

  await syncServices(supabase, barberId, data.serviceIds);
  revalidate();
  return { ok: true };
}

export async function setBarberActive(id, active) {
  const { supabase } = await requireAdmin();
  await supabase.from("barbers").update({ active }).eq("id", id);
  revalidate();
}

"use client";
import { useState } from "react";
import { useActionState } from "react";
import { saveBarber } from "./actions";
import AvailabilityEditor from "@/components/admin/availability-editor";
import ServicesMultiselect from "@/components/admin/services-multiselect";
import PhotoUploadField from "@/components/admin/photo-upload-field";

export default function BarberForm({ barber, services, selectedIds, trigger }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveBarber, {});
  const err = state?.fieldErrors || {};
  if (state?.ok && open) setTimeout(() => setOpen(false), 300);

  if (!open) {
    return <button className="admin-btn admin-btn-secondary" onClick={() => setOpen(true)}>{trigger}</button>;
  }
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 520 }}>
      <input type="hidden" name="id" defaultValue={barber?.id ?? ""} />

      <label className="admin-label">Name</label>
      <input className="admin-input" name="name" defaultValue={barber?.name ?? ""} />
      {err.name?.[0] && <p className="field-error">{err.name[0]}</p>}

      <label className="admin-label">Bio</label>
      <textarea className="admin-textarea" name="bio" defaultValue={barber?.bio ?? ""} />

      <label className="admin-label">Phone</label>
      <input className="admin-input" name="phone" defaultValue={barber?.phone ?? ""} />

      <label className="admin-label">Email</label>
      <input className="admin-input" name="email" defaultValue={barber?.email ?? ""} />
      {err.email?.[0] && <p className="field-error">{err.email[0]}</p>}

      <label className="admin-label">Sort order</label>
      <input className="admin-input" type="number" name="sort_order" defaultValue={barber?.sort_order ?? 0} />

      <PhotoUploadField currentUrl={barber?.photo_url} />
      <AvailabilityEditor value={barber?.availability} />
      <ServicesMultiselect services={services} selectedIds={selectedIds} />

      <label className="admin-label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="active" defaultChecked={barber ? barber.active : true} /> Active
      </label>

      {state?.error && <p className="form-error">{state.error}</p>}
      <div className="row-actions" style={{ marginTop: "0.75rem" }}>
        <button className="admin-btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button className="admin-btn admin-btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

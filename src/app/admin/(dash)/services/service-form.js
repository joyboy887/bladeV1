"use client";
import { useState } from "react";
import { useActionState } from "react";
import { saveService } from "./actions";

export default function ServiceForm({ service, trigger }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveService, {});
  const err = state?.fieldErrors || {};
  if (state?.ok && open) setTimeout(() => setOpen(false), 300);

  if (!open) {
    return (
      <button className="admin-btn admin-btn-secondary" onClick={() => setOpen(true)}>
        {trigger}
      </button>
    );
  }
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 420 }}>
      <input type="hidden" name="id" defaultValue={service?.id ?? ""} />
      <label className="admin-label">Name</label>
      <input className="admin-input" name="name" defaultValue={service?.name ?? ""} />
      {err.name?.[0] && <p className="field-error">{err.name[0]}</p>}

      <label className="admin-label">Description</label>
      <input className="admin-input" name="description" defaultValue={service?.description ?? ""} />

      <label className="admin-label">Duration (minutes)</label>
      <input className="admin-input" name="duration_minutes" type="number" defaultValue={service?.duration_minutes ?? 30} />
      {err.duration_minutes?.[0] && <p className="field-error">{err.duration_minutes[0]}</p>}

      <label className="admin-label">Price</label>
      <input className="admin-input" name="price" type="number" step="0.01" defaultValue={service?.price ?? 0} />
      {err.price?.[0] && <p className="field-error">{err.price[0]}</p>}

      <label className="admin-label">Sort order</label>
      <input className="admin-input" name="sort_order" type="number" defaultValue={service?.sort_order ?? 0} />

      <label className="admin-label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input name="active" type="checkbox" defaultChecked={service ? service.active : true} /> Active
      </label>

      {state?.error && <p className="form-error">{state.error}</p>}
      <div className="row-actions" style={{ marginTop: "0.75rem" }}>
        <button className="admin-btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button className="admin-btn admin-btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
